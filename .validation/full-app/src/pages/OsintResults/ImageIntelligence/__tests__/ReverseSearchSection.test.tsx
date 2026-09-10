import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../../services/api', () => ({
    getImages: vi.fn(), analyzeImageUpload: vi.fn(), analyzeImageUrl: vi.fn(), getImage: vi.fn(),
    reanalyzeImage: vi.fn(), deleteImageRecord: vi.fn(), getImageSimilarity: vi.fn(),
    runImageReverseSearch: vi.fn(), getImageReverseSearchHistory: vi.fn(), getImageProviders: vi.fn(),
    getImageTimeline: vi.fn(), addImageObservable: vi.fn(), getImageAiSummary: vi.fn(),
    imageFileUrl: vi.fn(() => 'https://localhost/uploads/images/x.jpg'),
    getRelationshipGraph: vi.fn(), getEvidence: vi.fn(), addEvidence: vi.fn()
}));

const { addImageObservable, addEvidence } = await import('../../../../services/api');
const { ReverseSearchSection, matchTypeLabel } = await import('../ImageIntelligenceHome');

const PROVIDERS = [
    { id: 'internal', label: 'Internal Similarity', capabilities: {} as any, status: { available: true, reason: null } },
    { id: 'google_vision', label: 'Google Cloud Vision (Web Detection)', capabilities: {} as any, status: { available: true, reason: null } },
    { id: 'bing_visual_search', label: 'Bing Visual Search', capabilities: {} as any, status: { available: false, reason: 'BING_VISUAL_SEARCH_KEY is not configured' } }
];

function makeResult(overrides: Partial<any> = {}) {
    return {
        provider: 'google_vision', providerLabel: 'Google Cloud Vision (Web Detection)', providers: ['Google Cloud Vision (Web Detection)'],
        queryId: null, matchType: 'possible_source', similarity: null, confidence: null,
        title: 'Example Security Advisory', pageUrl: 'https://example.com/advisory', imageUrl: null,
        thumbnailUrl: null, sourceDomain: 'example.com', publicationDate: null, retrievedAt: '2026-01-01T00:00:00Z',
        ...overrides
    };
}

describe('ReverseSearchSection — IMAGE_INTELLIGENCE_PHASE2.md "REVERSE SEARCH UI"', () => {
    beforeEach(() => {
        (addImageObservable as any).mockReset().mockResolvedValue({});
        (addEvidence as any).mockReset().mockResolvedValue({ id: 1 });
    });
    afterEach(() => cleanup());

    it('never claims "Original Source" and uses the spec\'s own match-type vocabulary', () => {
        expect(matchTypeLabel('possible_source')).toBe('Potential Source');
        expect(matchTypeLabel('near_exact')).toBe('Possible Match');
        expect(matchTypeLabel('visually_similar')).toBe('Visually Similar');
        expect(Object.values({ exact: matchTypeLabel('exact'), near_exact: matchTypeLabel('near_exact'), visually_similar: matchTypeLabel('visually_similar'), related_page: matchTypeLabel('related_page'), possible_source: matchTypeLabel('possible_source') }))
            .not.toContain('Original Source');
    });

    it('shows "Not provided" for a result the provider gave no confidence for, never a fabricated value', () => {
        render(
            <ReverseSearchSection
                imageId={1} providers={PROVIDERS} history={[]} results={[makeResult({ confidence: null, similarity: null })]}
                sources={[]} sourceTimeline={[]} brandMentions={[]} onSearched={() => {}}
            />
        );
        expect(screen.getByText(/Confidence:\s*Not provided/)).toBeInTheDocument();
    });

    it('labels a real LekirraX-computed similarity distinctly from provider confidence', () => {
        render(
            <ReverseSearchSection
                imageId={1} providers={PROVIDERS} history={[]}
                results={[makeResult({ provider: 'internal', providers: ['Internal Similarity'], similarity: 96, confidence: null, sourceDomain: null, pageUrl: null })]}
                sources={[]} sourceTimeline={[]} brandMentions={[]} onSearched={() => {}}
            />
        );
        expect(screen.getByText(/LekirraX Similarity 96%/)).toBeInTheDocument();
    });

    it('[Analyze Domain] pre-fills Domain Intelligence via onNavigateToModule without triggering any scan itself', () => {
        const onNavigateToModule = vi.fn();
        render(
            <ReverseSearchSection
                imageId={1} providers={PROVIDERS} history={[]} results={[makeResult()]}
                sources={[]} sourceTimeline={[]} brandMentions={[]} onSearched={() => {}} onNavigateToModule={onNavigateToModule}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Analyze Domain' }));
        expect(onNavigateToModule).toHaveBeenCalledWith('domain-intel', 'example.com');
        expect(onNavigateToModule).toHaveBeenCalledTimes(1); // no second call, no implicit scan trigger
    });

    it('flags a "Potential Brand Relationship" only when the domain looks like it contains the brand name, and offers [Analyze Brand]', () => {
        const onNavigateToModule = vi.fn();
        render(
            <ReverseSearchSection
                imageId={1} providers={PROVIDERS} history={[]}
                results={[makeResult({ sourceDomain: 'microsoft-secure-login.example', pageUrl: 'https://microsoft-secure-login.example/verify' })]}
                sources={[]} sourceTimeline={[]} brandMentions={[{ brand: 'Microsoft', officialDomains: ['microsoft.com'] }]}
                onSearched={() => {}} onNavigateToModule={onNavigateToModule}
            />
        );
        expect(screen.getByText(/Potential Brand Relationship: Microsoft/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Analyze Brand' }));
        expect(onNavigateToModule).toHaveBeenCalledWith('brand-intel', 'Microsoft');
    });

    it('does NOT flag a brand relationship for the brand\'s own official domain', () => {
        render(
            <ReverseSearchSection
                imageId={1} providers={PROVIDERS} history={[]}
                results={[makeResult({ sourceDomain: 'microsoft.com', pageUrl: 'https://microsoft.com/security' })]}
                sources={[]} sourceTimeline={[]} brandMentions={[{ brand: 'Microsoft', officialDomains: ['microsoft.com'] }]}
                onSearched={() => {}}
            />
        );
        expect(screen.queryByText(/Potential Brand Relationship/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Analyze Brand' })).not.toBeInTheDocument();
    });

    it('[Add Observable] calls the real IOC repository via addImageObservable with the result\'s domain', async () => {
        render(
            <ReverseSearchSection
                imageId={7} providers={PROVIDERS} history={[]} results={[makeResult()]}
                sources={[]} sourceTimeline={[]} brandMentions={[]} onSearched={() => {}}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Add Observable' }));
        expect(addImageObservable).toHaveBeenCalledWith(7, 'Domain', 'example.com');
        await screen.findByText('Observable Added');
    });

    it('[Save Evidence] persists via the existing generic evidence API, marked as Derived Evidence', async () => {
        render(
            <ReverseSearchSection
                imageId={7} providers={PROVIDERS} history={[]} results={[makeResult()]}
                sources={[]} sourceTimeline={[]} brandMentions={[]} onSearched={() => {}}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save Evidence' }));
        expect(addEvidence).toHaveBeenCalledWith(expect.objectContaining({
            entityType: 'image', entityId: 7, url: 'https://example.com/advisory',
            description: expect.stringContaining('Derived Evidence')
        }));
        await screen.findByText('Evidence Saved');
    });

    it('[Save Evidence] captures Domain, Title, and Search ID alongside Provider/URL/Match Type — IMAGE_INTELLIGENCE_PHASE3.md §6 field checklist', async () => {
        render(
            <ReverseSearchSection
                imageId={7} providers={PROVIDERS} history={[]}
                results={[makeResult({ searchId: 42, sourceDomain: 'example.com', title: 'Example Security Advisory' })]}
                sources={[]} sourceTimeline={[]} brandMentions={[]} onSearched={() => {}}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save Evidence' }));
        const call = (addEvidence as any).mock.calls[0][0];
        expect(call.description).toContain('Title: Example Security Advisory');
        expect(call.description).toContain('Domain: example.com');
        expect(call.description).toContain('Search ID: 42');
        expect(call.description).toMatch(/Retrieved:/);
    });

    it('[Save Evidence] never fabricates a Search ID when the result genuinely has none', async () => {
        render(
            <ReverseSearchSection
                imageId={7} providers={PROVIDERS} history={[]}
                results={[makeResult({ searchId: undefined })]}
                sources={[]} sourceTimeline={[]} brandMentions={[]} onSearched={() => {}}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save Evidence' }));
        const call = (addEvidence as any).mock.calls[0][0];
        expect(call.description).not.toContain('Search ID');
    });

    it('provider tabs filter the result grid without losing unfiltered-out results', () => {
        render(
            <ReverseSearchSection
                imageId={1} providers={PROVIDERS} history={[]}
                results={[
                    makeResult({ provider: 'google_vision', providers: ['Google Cloud Vision (Web Detection)'], sourceDomain: 'a.example', pageUrl: 'https://a.example', title: 'A' }),
                    makeResult({ provider: 'internal', providers: ['Internal Similarity'], sourceDomain: null, pageUrl: null, title: 'B', similarity: 90 })
                ]}
                sources={[]} sourceTimeline={[]} brandMentions={[]} onSearched={() => {}}
            />
        );
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: /Internal Similarity/ }));
        expect(screen.queryByText('A')).not.toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('marks the results grid empty state honestly when there are none, never inventing a placeholder result', () => {
        render(
            <ReverseSearchSection
                imageId={1} providers={PROVIDERS} history={[]} results={[]}
                sources={[]} sourceTimeline={[]} brandMentions={[]} onSearched={() => {}}
            />
        );
        expect(screen.getByText('No reverse image search results found.')).toBeInTheDocument();
    });

    it('shows each configured provider\'s honest status, including "Not Configured" for Bing', () => {
        render(
            <ReverseSearchSection
                imageId={1} providers={PROVIDERS} history={[]} results={[]}
                sources={[]} sourceTimeline={[]} brandMentions={[]} onSearched={() => {}}
            />
        );
        expect(screen.getByText(/BING_VISUAL_SEARCH_KEY is not configured/)).toBeInTheDocument();
    });
});
