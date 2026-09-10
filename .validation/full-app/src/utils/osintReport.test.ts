import { describe, expect, it } from 'vitest';
import { buildOsintEntries, validateOsintEntries, WEB_CHECK_OSINT_MODULES } from './osintReport';

describe('osintReport utilities', () => {
    it('normalizes OSINT results for screen and print rendering', () => {
        const state = {
            'asset-radar': {
                loading: false,
                error: null,
                result: {
                    module: 'asset-radar',
                    risk: 'Medium',
                    data: {
                        target: 'example.com',
                        provider: 'AssetRadar',
                        sources: ['crt.sh', 'Shodan'],
                        score: 82,
                        confidence: 0.91,
                        results: [{ platform: 'crt.sh' }, { platform: 'Shodan' }]
                    }
                }
            }
        };

        const entries = buildOsintEntries(WEB_CHECK_OSINT_MODULES.slice(0, 1), state);

        expect(entries).toHaveLength(1);
        expect(entries[0].title).toBe('AssetRadar');
        expect(entries[0].risk).toBe('Medium');
        expect(entries[0].sourceRows.some((row) => row.label === 'Sources')).toBe(true);
        expect(entries[0].metricRows.some((row) => row.label === 'Score')).toBe(true);
        expect(entries[0].rawFindings).toContain('"provider": "AssetRadar"');
        expect(entries[0].validation.isConsistent).toBe(true);
    });

    it('reports loading, errors, and inconsistent modules', () => {
        const entries = buildOsintEntries(WEB_CHECK_OSINT_MODULES.slice(0, 2), {
            'asset-radar': {
                loading: true,
                error: null,
                result: null
            },
            'alias-finder': {
                loading: false,
                error: 'Timed out',
                result: null
            }
        });

        const report = validateOsintEntries(entries);

        expect(report.loadingModules).toContain('AssetRadar');
        expect(report.errorModules).toContain('AliasFinder');
        expect(report.loadedCount).toBe(0);
        expect(report.totalCount).toBe(2);
    });
});
