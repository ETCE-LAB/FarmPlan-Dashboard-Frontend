// src/components/PlantImage.jsx
// Renders a plant photo with full CC attribution below it.
// Used in both DragDropCrops cards and the PlantsPanel accordion.
//
// Props:
//   sourceId  – plant ID (e.g. "S01") – used to fetch image metadata
//   size      – "card" | "panel"  (controls layout)
//   alt       – image alt text (plant name)

import { usePlantImage } from '../hooks/usePlantImage';
import './PlantImage.css';

function PlantImage({ sourceId, size = 'panel', alt = '' }) {
  const { image, isLoading } = usePlantImage(sourceId);

  // ── Card size (DragDropCrops — small square) ────────────────────────────
  if (size === 'card') {
    if (isLoading) {
      return (
        <div className="pi-card-placeholder pi-card-loading" aria-hidden="true">
          <span className="pi-card-shimmer" />
        </div>
      );
    }
    if (!image) {
      return (
        <div className="pi-card-placeholder" aria-label="No image available">
          <span className="pi-card-no-img">🌿</span>
        </div>
      );
    }
    return (
      <div className="pi-card-wrap">
        <img
          src={image.image_url}
          alt={alt || image.plant_name}
          className="pi-card-img"
          loading="lazy"
        />
        <div className="pi-card-attribution">
          <span className="pi-card-author">© {image.author_name}</span>
          {' · '}
          <a href={image.license_url} target="_blank" rel="noopener noreferrer" className="pi-card-license">
            {image.license_name}
          </a>
        </div>
      </div>
    );
  }

  // ── Panel size (PlantsPanel accordion — wider) ──────────────────────────
  if (isLoading) {
    return (
      <div className="pi-panel-skeleton" aria-hidden="true">
        <span className="pi-card-shimmer" />
      </div>
    );
  }
  if (!image) return null;

  return (
    <div className="pi-panel-wrap">
      <img
        src={image.image_url}
        alt={alt || image.plant_name}
        className="pi-panel-img"
        loading="lazy"
      />
      <p className="pi-panel-attribution">
        <span className="pi-attr-label">Photo:</span>{' '}
        <span>{image.author_name}</span>
        {' '}via{' '}
        <a href={image.source_page_url} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
        {' — '}
        <a href={image.license_url} target="_blank" rel="noopener noreferrer">{image.license_name}</a>
      </p>
    </div>
  );
}

export default PlantImage;