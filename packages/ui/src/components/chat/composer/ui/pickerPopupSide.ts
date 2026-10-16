/** Room under a draft picker's trigger, in px, below which its popup opens upward. */
const PICKER_POPUP_MIN_ROOM_BELOW = 240;

/**
 * A draft picker's popup (project or branch) opens downward unless the
 * trigger sits low, as in Mini Chat, and there is more room above it.
 * `bounds` is the main area the popup is kept inside, clipped to the window
 * by the caller.
 */
export const choosePickerPopupSide = (
    trigger: { top: number; bottom: number },
    bounds: { top: number; bottom: number },
): 'top' | 'bottom' => {
    const roomBelow = bounds.bottom - trigger.bottom;
    const roomAbove = trigger.top - bounds.top;
    return roomBelow < PICKER_POPUP_MIN_ROOM_BELOW && roomAbove > roomBelow ? 'top' : 'bottom';
};
