// KNOWLEDGE_BASE_PHASE1.md §32 "CONTENT SECURITY" / §40 CASE 4 — Knowledge
// Entry content is rendered with the app's existing `react-markdown`
// dependency (KnowledgeBasePage.tsx's MarkdownPreview/MarkdownField), never
// dangerouslySetInnerHTML and never the rehype-raw plugin — so raw HTML/
// script embedded in analyst-authored Markdown is rendered as inert TEXT,
// not executed or inserted into the DOM as real elements. This test proves
// that guarantee directly against the same <Markdown remarkPlugins=
// {[remarkGfm]}> call KnowledgeBasePage.tsx uses, without needing to stand
// up the whole page (API calls, routing, etc).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

afterEach(() => cleanup());

function renderMarkdown(text: string) {
    return render(<Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>);
}

describe('CASE 4 — unsafe HTML/script in Knowledge content is sanitized (never executed)', () => {
    it('a raw <script> tag is never inserted into the DOM as an executable element', () => {
        const { container } = renderMarkdown('Some analyst text.\n\n<script>window.__kb_xss__ = true;</script>\n\nMore text.');
        expect(container.querySelector('script')).toBeNull();
        expect((window as any).__kb_xss__).toBeUndefined();
    });

    it('an <img onerror=...> injection attempt never becomes a live DOM element with the handler attached', () => {
        const { container } = renderMarkdown('<img src=x onerror="window.__kb_xss__=true">');
        const img = container.querySelector('img');
        // react-markdown (no rehype-raw) renders raw HTML as literal text, so
        // either no <img> exists at all, or if one somehow did, it must not
        // carry a live onerror handler.
        if (img) expect(img.onerror).toBeNull();
        expect((window as any).__kb_xss__).toBeUndefined();
    });

    it('a javascript: link href is never rendered as a clickable, script-executing anchor', () => {
        const { container } = renderMarkdown('[click me](javascript:window.__kb_xss__=true)');
        const link = container.querySelector('a');
        if (link) expect(link.getAttribute('href')).not.toMatch(/^javascript:/i);
    });

    it('legitimate Markdown (headings, lists, links, tables, code) still renders normally', () => {
        renderMarkdown('## Detection\n\n- indicator one\n- indicator two\n\n[MITRE ATT&CK](https://attack.mitre.org)\n\n| Field | Value |\n|---|---|\n| Type | Domain |\n\n`ioc.example.com`');
        expect(screen.getByRole('heading', { level: 2, name: 'Detection' })).toBeTruthy();
        expect(screen.getAllByRole('listitem').length).toBe(2);
        const link = screen.getByRole('link', { name: 'MITRE ATT&CK' });
        expect(link.getAttribute('href')).toBe('https://attack.mitre.org');
        expect(screen.getByText('ioc.example.com').tagName.toLowerCase()).toBe('code');
    });
});
