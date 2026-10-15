// Native tray/menu bar controller.
//
// Surfaces a glanceable, always-visible view of OpenChamber's live state:
//  1. an aggregate activity indicator (idle / busy / error+retry) in the icon
//     title, rendered as a monochrome template image plus a text counter so it
//     adapts to light/dark menu bars (colour can't be shown in template mode);
//  2. pending approvals (permission + question requests) that block agents,
//     with inline Allow/Deny actions;
//  3. the list of active sessions with status + branch, click to focus;
//  4. quick actions (new session, show window, quit).
//
// The live state lives in the renderer (Zustand). It is pushed here over the
// existing IPC bridge via the `desktop_tray_update` command; this module owns
// only presentation. Tray clicks call back through `onAction`, which main.mjs
// routes to the renderer (focus-session, respond-permission, …) or handles
// natively (show-main-window, quit).

import { Tray, Menu, nativeImage } from 'electron';
import { buildTrayMenuTemplate, trayMenuKey } from './tray-menu.mjs';

const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
// Linux StatusNotifier hosts often blank or drop oversized tray images; keep
// the icon at a panel-typical size so AppImage trays stay visible.
const LINUX_TRAY_ICON_PX = 22;

// Text shown next to the icon — reserved for the two states where a precise
// count is actionable: pending approvals and errors. Busy and unread are
// conveyed by the icon itself (animated / filled faces), so they add no text.
// Glyphs come from the Geometric Shapes block so macOS renders them monochrome
// (not colour emoji) and tints them with the menu bar like the template icon.
const computeTitle = (counts) => {
  if (counts.approvals > 0) return `◆ ${counts.approvals}`; // decision needed
  if (counts.error > 0) return `▲ ${counts.error}`;         // problem
  return '';
};

// Which icon variant to show. Busy work toggles outline and fill once a
// second; unread (with nothing active) holds a static filled cube until the
// state clears; otherwise the plain outline.
const computeIconState = (counts) => {
  if (counts.busy > 0) return 'busy';
  if (counts.unseen > 0) return 'unseen';
  return 'idle';
};

const computeTooltip = (counts, sessionCount) => {
  if (sessionCount === 0) return 'OpenChamber — no active sessions';
  const bits = [];
  if (counts.approvals > 0) bits.push(`${counts.approvals} awaiting approval`);
  if (counts.error > 0) bits.push(`${counts.error} with errors`);
  if (counts.busy > 0) bits.push(`${counts.busy} working`);
  if (counts.unseen > 0) bits.push(`${counts.unseen} unread`);
  const suffix = bits.length ? ` · ${bits.join(', ')}` : ' · idle';
  return `OpenChamber — ${sessionCount} session${sessionCount === 1 ? '' : 's'}${suffix}`;
};

// While a session works, the icon toggles between the outline and the filled
// cube once a second. A busy state can last hours: the 16-frame breath it
// replaced called setImage 13 times a second, which cost the main process 7.5
// to 8.6% of a core and macOS's WindowServer about 8% more (measured on an
// M-series Mac, against 0.5 to 0.8% at rest).
const BUSY_TOGGLE_MS = 1000;

const toTemplateImage = (p) => {
  let image = nativeImage.createFromPath(p);
  if (image.isEmpty()) return image;
  if (isMac) image.setTemplateImage(true);
  if (isLinux) {
    const { width, height } = image.getSize();
    if (width > LINUX_TRAY_ICON_PX || height > LINUX_TRAY_ICON_PX) {
      image = image.resize({
        width: LINUX_TRAY_ICON_PX,
        height: LINUX_TRAY_ICON_PX,
        quality: 'best',
      });
    }
  }
  return image;
};

// idleIconPath: plain outline (calm state). unseenIconPath: statically filled
// (a finished session left unread). Busy alternates the two; where both are the
// same image (Windows and Linux use the app icon) busy stands still.
export const createTrayController = ({ idleIconPath, unseenIconPath, statusIconPaths, onAction }) => {
  let tray = null;
  let lastTitle = null;
  let lastTooltip = null;
  let lastMenuKey = null;

  // macOS auto-picks the @2x file next to each path and tints the alpha.
  // Windows uses the regular app icon and ignores template tinting.
  const idleFrame = toTemplateImage(idleIconPath);
  const unseenFrame = toTemplateImage(unseenIconPath);
  const busyToggles = idleIconPath !== unseenIconPath;
  // Per-row status icons (template images, tinted + vertically centred by macOS).
  const statusIcons = {};
  for (const [key, p] of Object.entries(statusIconPaths || {})) {
    statusIcons[key] = toTemplateImage(p);
  }

  let iconState = null;
  let animTimer = null;

  const stopAnim = () => {
    if (animTimer) {
      clearInterval(animTimer);
      animTimer = null;
    }
  };

  const startAnim = () => {
    if (animTimer || !tray || tray.isDestroyed?.()) return;
    let filled = true;
    tray.setImage(unseenFrame);
    animTimer = setInterval(() => {
      if (!tray || tray.isDestroyed?.()) return;
      filled = !filled;
      tray.setImage(filled ? unseenFrame : idleFrame);
    }, BUSY_TOGGLE_MS);
  };

  const applyIconState = (nextState) => {
    if (nextState === iconState) return;
    iconState = nextState;
    if (!tray || tray.isDestroyed?.()) return;
    if (nextState === 'busy') {
      if (busyToggles) startAnim();
      else tray.setImage(idleFrame);
    } else if (nextState === 'unseen') {
      stopAnim();
      tray.setImage(unseenFrame);
    } else {
      stopAnim();
      tray.setImage(idleFrame);
    }
  };

  const ensureTray = () => {
    if (tray && !tray.isDestroyed?.()) return tray;
    tray = new Tray(idleFrame);
    tray.setIgnoreDoubleClickEvents(true);
    if (!isMac) {
      // Windows: left-click shows. Linux: left-click toggles show/hide so the
      // panel icon stays useful when the window is already open.
      tray.on('click', () => onAction({
        type: isLinux ? 'toggle-main-window' : 'show-main-window',
      }));
    }
    return tray;
  };

  const buildMenu = (snapshot) => Menu.buildFromTemplate(buildTrayMenuTemplate(snapshot, { onAction, statusIcons }));

  const update = (rawSnapshot) => {
    const snapshot = rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};
    const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
    const approvals = Array.isArray(snapshot.approvals) ? snapshot.approvals : [];

    const counts = {
      busy: sessions.filter((s) => s.status === 'busy' || s.status === 'retry').length,
      error: sessions.filter((s) => s.hasError).length,
      approvals: approvals.length,
      unseen: sessions.reduce((sum, s) => sum + (Number.isFinite(s.unseen) ? s.unseen : 0), 0),
    };

    const widget = ensureTray();
    const title = computeTitle(counts);
    if (title !== lastTitle) {
      widget.setTitle(title);
      lastTitle = title;
    }
    applyIconState(computeIconState(counts));
    const tooltip = computeTooltip(counts, sessions.length);
    if (tooltip !== lastTooltip) {
      widget.setToolTip(tooltip);
      lastTooltip = tooltip;
    }
    const key = trayMenuKey(snapshot);
    if (key !== lastMenuKey) {
      widget.setContextMenu(buildMenu(snapshot));
      lastMenuKey = key;
    }
  };

  const destroy = () => {
    stopAnim();
    if (tray && !tray.isDestroyed?.()) {
      tray.destroy();
    }
    tray = null;
    lastTitle = null;
    lastTooltip = null;
    lastMenuKey = null;
    iconState = null;
  };

  return { update, destroy };
};
