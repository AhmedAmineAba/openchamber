import type { DecorateContext } from '../markdown/decorate';

export const MESSAGE_IMAGE_EXPORT_EXCLUDE_ATTRIBUTE = 'data-message-image-export-exclude';

export const cloneMessageImageExportSource = (source: HTMLElement): HTMLElement => {
    // SAFETY: cloneNode preserves the concrete type of an HTMLElement source.
    const clone = source.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(`[${MESSAGE_IMAGE_EXPORT_EXCLUDE_ATTRIBUTE}="true"]`).forEach((element) => {
        element.remove();
    });
    return clone;
};

// An image has no buttons to label and no settings to toggle: the decoration
// only has to draw code blocks and tables the way the chat does.
const IMAGE_DECORATE_CONTEXT: DecorateContext = {
    labels: {
        copy: '',
        copied: '',
        enableCodeWrap: '',
        disableCodeWrap: '',
        enableTableWrap: '',
        disableTableWrap: '',
        copyTable: '',
        downloadTable: '',
        copyDiagram: '',
        downloadDiagram: '',
        zoomInDiagram: '',
        zoomOutDiagram: '',
        resetDiagramView: '',
        previewLabel: '',
        previewTitle: '',
    },
    mermaidControls: { download: false, copy: false, showPanZoomControls: false },
    codeBlockLineWrap: false,
    tableCellWrap: false,
    renderMermaid: () => ({}),
};

/** Renders assistant Markdown to sanitized, highlighted HTML the way the chat does. */
const renderAssistantMarkdownHtml = async (text: string): Promise<string> => {
    const { renderMarkdownBlocks } = await import('../markdown/markdownCore');
    const blocks = await renderMarkdownBlocks(text, false, 'label');
    return blocks.map((block) => block.html).join('');
};

/**
 * The image source for a whole turn: the text its earlier steps wrote, then
 * the rendered text parts of its last message. Earlier steps may be folded
 * away or not mounted, so their text is rendered here from Markdown with the
 * classes and decoration the chat uses.
 */
export const buildTurnImageExportSource = async (
    earlierText: readonly string[],
    messageSources: readonly HTMLElement[],
    renderMarkdownHtml: (text: string) => Promise<string> = renderAssistantMarkdownHtml,
): Promise<HTMLElement> => {
    const { decorateMarkdown } = await import('../markdown/decorate');
    const source = document.createElement('div');
    // The chat sets the code colours as inline variables on each Markdown root.
    const syntaxStyle = messageSources
        .map((element) => element.querySelector('[data-markdown-content]')?.getAttribute('style'))
        .find((style) => Boolean(style));

    for (const text of earlierText) {
        const html = await renderMarkdownHtml(text);
        const segment = document.createElement('div');
        segment.className = 'relative break-words my-1';
        const markdown = document.createElement('div');
        markdown.className = 'markdown-content leading-relaxed';
        if (syntaxStyle) markdown.setAttribute('style', syntaxStyle);
        markdown.innerHTML = html;
        decorateMarkdown(markdown, IMAGE_DECORATE_CONTEXT);
        segment.appendChild(markdown);
        source.appendChild(segment);
    }
    for (const element of messageSources) {
        source.appendChild(cloneMessageImageExportSource(element));
    }
    return source;
};
