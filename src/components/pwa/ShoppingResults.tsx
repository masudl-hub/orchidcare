import React from 'react';
import { motion } from 'framer-motion';

const mono = 'ui-monospace, monospace';
const pixel = "'Press Start 2P', monospace";

interface Product {
  title: string;
  price?: string;
  extractedPrice?: number;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  link?: string;
  source?: string;
  snippet?: string;
}

interface Store {
  name: string;
  fullName?: string;
  type: string;
  distance?: string;
  driveTime?: string;
  address?: string;
  phone?: string;
  reasoning: string;
  likelyHasProduct: boolean;
  productNotes?: string;
  placeId?: string;
  mapsUri?: string;
  addressVerified: boolean;
}

interface ShoppingResultsProps {
  products?: Product[];
  productSearchQuery?: string;
  stores?: Store[];
  storeSearchQuery?: string;
  storeLocation?: string;
}

function formatReviewCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function getMapsUrl(store: Store): string {
  if (store.mapsUri) return store.mapsUri;
  const q = store.address
    ? `${store.name}, ${store.address}`
    : store.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const cardStagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const cardItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};

function ProductsSection({ products, query }: { products: Product[]; query?: string }) {
  const visible = products.slice(0, 8);

  return (
    <div>
      {/* Section header */}
      <div style={{
        fontFamily: pixel,
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#fff',
        marginBottom: '4px',
      }}>
        PRODUCTS
      </div>

      {query && (
        <div style={{
          fontFamily: mono,
          fontSize: '11px',
          color: 'rgba(255,255,255,0.35)',
          marginBottom: '12px',
        }}>
          {query}
        </div>
      )}

      {/* Horizontal scroll container */}
      <motion.div
        variants={cardStagger}
        initial="hidden"
        animate="visible"
        style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '4px',
          /* Hide scrollbar across browsers */
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
        className="hide-scrollbar"
      >
        {visible.map((product, i) => (
          <motion.a
            key={i}
            variants={cardItem}
            href={product.link || '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              flexShrink: 0,
              width: '160px',
              scrollSnapAlign: 'start',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent',
              textDecoration: 'none',
              overflow: 'hidden',
            }}
          >
            {/* Thumbnail */}
            {product.thumbnail ? (
              <div style={{
                width: '160px',
                height: '120px',
                overflow: 'hidden',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.03)',
              }}>
                <img
                  src={product.thumbnail}
                  alt={product.title}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>
            ) : (
              <div style={{
                width: '160px',
                height: '120px',
                background: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: mono,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.15)',
              }}>
                no image
              </div>
            )}

            {/* Card body */}
            <div style={{ padding: '8px' }}>
              {/* Title */}
              <div style={{
                fontFamily: mono,
                fontSize: '11px',
                color: 'rgba(255,255,255,0.85)',
                lineHeight: '1.4',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                marginBottom: '4px',
              }}>
                {product.title}
              </div>

              {/* Price */}
              {product.price && (
                <div style={{
                  fontFamily: mono,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: 'bold',
                  marginBottom: '4px',
                }}>
                  {product.price}
                </div>
              )}

              {/* Rating */}
              {product.rating != null && (
                <div style={{
                  fontFamily: mono,
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.4)',
                  marginBottom: '4px',
                }}>
                  {'★ '}{product.rating}
                  {product.reviews != null && ` (${formatReviewCount(product.reviews)})`}
                </div>
              )}

              {/* Source */}
              {product.source && (
                <div style={{
                  fontFamily: mono,
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.25)',
                }}>
                  {product.source}
                </div>
              )}
            </div>
          </motion.a>
        ))}
      </motion.div>

      {/* Inline style tag to hide scrollbar (CSS pseudo-elements can't be inline) */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function StoresSection({ stores, query, location: loc }: { stores: Store[]; query?: string; location?: string }) {
  return (
    <div>
      {/* Section header */}
      <div style={{
        fontFamily: pixel,
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#fff',
        marginBottom: '4px',
      }}>
        STORES NEARBY
      </div>

      {(query || loc) && (
        <div style={{
          fontFamily: mono,
          fontSize: '11px',
          color: 'rgba(255,255,255,0.35)',
          marginBottom: '12px',
        }}>
          {[query, loc].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Vertical stack */}
      <motion.div
        variants={cardStagger}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        {stores.map((store, i) => (
          <motion.div
            key={i}
            variants={cardItem}
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '12px',
            }}
          >
            {/* Store name */}
            <div style={{
              fontFamily: mono,
              fontSize: '12px',
              color: 'rgba(255,255,255,0.85)',
              fontWeight: 'bold',
              marginBottom: '4px',
            }}>
              {store.fullName || store.name}
            </div>

            {/* Type badge */}
            <div style={{
              display: 'inline-block',
              fontFamily: mono,
              fontSize: '9px',
              color: 'rgba(255,255,255,0.45)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '2px 6px',
              marginBottom: '6px',
              textTransform: 'lowercase',
            }}>
              {store.type}
            </div>

            {/* Distance + drive time */}
            {(store.distance || store.driveTime) && (
              <div style={{
                fontFamily: mono,
                fontSize: '11px',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: '4px',
              }}>
                {[store.distance, store.driveTime].filter(Boolean).join(' · ')}
              </div>
            )}

            {/* Address */}
            {store.address && (
              <a
                href={getMapsUrl(store)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  fontFamily: mono,
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.5)',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(255,255,255,0.2)',
                  marginBottom: '4px',
                }}
              >
                {store.address}
              </a>
            )}

            {/* Phone */}
            {store.phone && (
              <a
                href={`tel:${store.phone}`}
                style={{
                  display: 'block',
                  fontFamily: mono,
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.5)',
                  textDecoration: 'none',
                  marginBottom: '4px',
                }}
              >
                {store.phone}
              </a>
            )}

            {/* Product notes */}
            {store.productNotes && (
              <div style={{
                fontFamily: mono,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.35)',
                fontStyle: 'italic',
                marginBottom: '8px',
              }}>
                {store.productNotes}
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
              <a
                href={getMapsUrl(store)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: mono,
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(255,255,255,0.2)',
                }}
              >
                directions
              </a>
              {store.phone && (
                <a
                  href={`tel:${store.phone}`}
                  style={{
                    fontFamily: mono,
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.5)',
                    textDecoration: 'underline',
                    textDecorationColor: 'rgba(255,255,255,0.2)',
                  }}
                >
                  call
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export function ShoppingResults({
  products,
  productSearchQuery,
  stores,
  storeSearchQuery,
  storeLocation,
}: ShoppingResultsProps) {
  const hasProducts = products && products.length > 0;
  const hasStores = stores && stores.length > 0;

  if (!hasProducts && !hasStores) return null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginTop: '12px' }}
    >
      {hasProducts && (
        <ProductsSection products={products!} query={productSearchQuery} />
      )}

      {hasProducts && hasStores && (
        <div style={{
          height: '1px',
          background: 'rgba(255,255,255,0.06)',
          margin: '16px 0',
        }} />
      )}

      {hasStores && (
        <StoresSection stores={stores!} query={storeSearchQuery} location={storeLocation} />
      )}
    </motion.div>
  );
}
