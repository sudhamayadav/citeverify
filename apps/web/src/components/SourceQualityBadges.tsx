import React from 'react';
import type { PublicationType, PeerReviewStatus } from '../../../../apps/api/src/lib/sourceQuality';

export interface SourceQualityBadgesProps {
  publicationType: PublicationType;
  publicationTypeBasis?: string | null;
  publicationTypeSourceUrl?: string | null;
  peerReviewStatus: PeerReviewStatus;
  peerReviewBasis?: string | null;
  peerReviewSourceUrl?: string | null;
  retractionStatus?: 'CONFIRMED_RETRACTED' | 'SEARCHED_NO_NOTICE_FOUND' | 'UNKNOWN';
  correctionStatus?: 'CONFIRMED_CORRECTION' | 'SEARCHED_NO_CORRECTION_FOUND' | 'UNKNOWN';
}

export function SourceQualityBadges({
  publicationType,
  publicationTypeBasis,
  publicationTypeSourceUrl,
  peerReviewStatus,
  peerReviewBasis,
  peerReviewSourceUrl,
  retractionStatus = 'UNKNOWN',
  correctionStatus = 'UNKNOWN',
}: SourceQualityBadgesProps) {
  return (
    <div
      role="group"
      aria-label="Source Quality & Verification Status"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        alignItems: 'center',
        marginTop: '0.5rem',
        fontSize: '0.75rem',
      }}
    >
      {/* 1. Publication Type Badge */}
      <span
        title={publicationTypeBasis || 'Publication category classification'}
        style={{
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          fontWeight: 600,
          backgroundColor: publicationType === 'PREPRINT' ? '#fef3c7' : '#e0e7ff',
          color: publicationType === 'PREPRINT' ? '#92400e' : '#3730a3',
          border: '1px solid currentColor',
        }}
      >
        Type: {publicationType.replace(/_/g, ' ')}
      </span>

      {/* 2. Peer Review Evidence Badge */}
      <span
        title={peerReviewBasis || 'Independent assessment of peer-review statement'}
        style={{
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          fontWeight: 600,
          backgroundColor:
            peerReviewStatus === 'VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT'
              ? '#dcfce7'
              : '#f1f5f9',
          color:
            peerReviewStatus === 'VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT'
              ? '#166534'
              : '#475569',
          border: '1px solid currentColor',
        }}
      >
        Peer Review: {peerReviewStatus === 'VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT' ? 'VERIFIED' : 'NOT ESTABLISHED'}
      </span>

      {/* 3. Retraction Status Badge */}
      {retractionStatus === 'CONFIRMED_RETRACTED' && (
        <span
          title="Authoritative retraction notice verified"
          style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontWeight: 700,
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #ef4444',
          }}
        >
          RETRACTED
        </span>
      )}

      {/* 4. Correction Status Badge */}
      {correctionStatus === 'CONFIRMED_CORRECTION' && (
        <span
          title="Published correction / erratum notice verified"
          style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontWeight: 600,
            backgroundColor: '#ffedd5',
            color: '#9a3412',
            border: '1px solid #f97316',
          }}
        >
          CORRECTION FOUND
        </span>
      )}
    </div>
  );
}
