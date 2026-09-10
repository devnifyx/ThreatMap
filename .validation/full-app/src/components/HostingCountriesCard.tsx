import React from 'react';
import type { HostingCountryEntry } from '../types';
import HostingCountriesMap from './HostingCountriesMap';
import './HostingCountriesCard.css';

const HostingCountriesCard: React.FC<{ countries: HostingCountryEntry[] }> = ({ countries }) => {
    return (
        <div className="osint-card hosting-countries-card">
            <div className="hosting-countries-header-wrap">
                <div className="hosting-countries-header">
                    <span className="osint-icon">🌐</span>
                    <h3 className="osint-title">Hosting Countries</h3>
                    <span className="hosting-countries-count-badge">
                        {countries.length} {countries.length === 1 ? 'country' : 'countries'}
                    </span>
                </div>
            </div>
            <div className="osint-card-content">
                <HostingCountriesMap countries={countries} />
            </div>
        </div>
    );
};

export default HostingCountriesCard;
