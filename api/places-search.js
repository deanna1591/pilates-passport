/**
 * Vercel Serverless Function: api/places-search
 * Proxies Google Places API — keeps API key server-side.
 *
 * Modes:
 *   ?query=pilates+phoenix          → Text search
 *   ?lat=33.44&lng=-112.07          → Nearby search
 *   ?place_id=ChIJ...               → Place details (website, phone, hours, photos)
 *   ?photo_ref=Aap_u...&maxwidth=800 → Proxy a Places photo
 *   ?map_embed=1&lat=...&lng=...    → Return Maps Embed URL
 *
 * Server env vars (set in Vercel → Project → Settings → Environment Variables):
 *   GOOGLE_PLACES_API_KEY
 *   GOOGLE_MAPS_EMBED_KEY
 */

const BASE = "https://maps.googleapis.com/maps/api/place"

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  res.setHeader("Content-Type", "application/json")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.error("[places-search] GOOGLE_PLACES_API_KEY not set")
    return res.status(200).json({ studios: [], error: "API key not configured" })
  }

  const p = req.query || {}
  const { query, lat, lng, radius = "15000", place_id, photo_ref, maxwidth = "800", map_embed } = p

  try {
    // ── MODE 0: Photo proxy ─────────────────────────────────────────────────
    if (photo_ref) {
      const photoUrl = `${BASE}/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(photo_ref)}&key=${apiKey}`
      const response = await fetch(photoUrl, { redirect: "follow" })
      res.setHeader("Cache-Control", "public, max-age=86400")
      return res.status(200).json({ imageUrl: response.url })
    }

    // ── MODE 0b: Maps Embed URL ─────────────────────────────────────────────
    if (map_embed) {
      const mapsKey = process.env.GOOGLE_MAPS_EMBED_KEY || apiKey
      const centerLat = lat || "40.7128"
      const centerLng = lng || "-74.0060"
      const zoom = p.zoom || "13"
      const embedUrl = `https://www.google.com/maps/embed/v1/search?key=${mapsKey}&q=pilates+studio&center=${centerLat},${centerLng}&zoom=${zoom}`
      res.setHeader("Cache-Control", "public, max-age=300")
      return res.status(200).json({ embedUrl })
    }

    // ── MODE 1: Place details ───────────────────────────────────────────────
    if (place_id) {
      const fields = [
        "name", "formatted_address", "geometry",
        "rating", "user_ratings_total",
        "formatted_phone_number", "website",
        "opening_hours", "types", "url",
        "business_status", "photos", "icon",
      ].join(",")

      const url = `${BASE}/details/json?place_id=${encodeURIComponent(place_id)}&fields=${fields}&key=${apiKey}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.status !== "OK") {
        return res.status(200).json({ studio: null })
      }

      const photoRefs = (data.result.photos || []).slice(0, 3).map(p => p.photo_reference)
      const photoUrls = await resolvePhotoUrls(photoRefs, apiKey)

      return res.status(200).json({ studio: mapDetail(data.result, place_id, photoUrls) })
    }

    // ── MODE 2: Nearby search ───────────────────────────────────────────────
    if (lat && lng) {
      let url = `${BASE}/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=pilates&key=${apiKey}`
      let response = await fetch(url)
      let data = await response.json()

      if (!data.results || data.results.length === 0) {
        url = `${BASE}/textsearch/json?query=pilates+studio&location=${lat},${lng}&radius=${radius}&key=${apiKey}`
        response = await fetch(url)
        data = await response.json()
      }

      const studios = await Promise.all(
        (data.results || []).slice(0, 20).map(async r => {
          const photoRef = r.photos?.[0]?.photo_reference
          const photoUrl = photoRef ? await resolvePhotoUrl(photoRef, apiKey, 400) : null
          return mapResult(r, photoUrl)
        })
      )

      return res.status(200).json({ studios })
    }

    // ── MODE 3: Text search ─────────────────────────────────────────────────
    if (query) {
      const q = query.toLowerCase().includes("pilates")
        ? query
        : `pilates studio ${query}`

      const url = `${BASE}/textsearch/json?query=${encodeURIComponent(q)}&key=${apiKey}`
      const response = await fetch(url)
      const data = await response.json()

      const studios = await Promise.all(
        (data.results || []).slice(0, 15).map(async r => {
          const photoRef = r.photos?.[0]?.photo_reference
          const photoUrl = photoRef ? await resolvePhotoUrl(photoRef, apiKey, 400) : null
          return mapResult(r, photoUrl)
        })
      )

      return res.status(200).json({ studios })
    }

    return res.status(400).json({ error: "Provide query, lat/lng, place_id, or photo_ref", studios: [] })

  } catch (err) {
    console.error("[places-search] Error:", err)
    return res.status(500).json({ error: err.message, studios: [] })
  }
}

async function resolvePhotoUrl(photoRef, apiKey, maxwidth = 800) {
  if (!photoRef) return null
  try {
    const url = `${BASE}/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(photoRef)}&key=${apiKey}`
    const res = await fetch(url, { redirect: "follow" })
    return res.url || null
  } catch {
    return null
  }
}

async function resolvePhotoUrls(refs, apiKey) {
  const results = await Promise.all(refs.map(ref => resolvePhotoUrl(ref, apiKey, 800)))
  return results.filter(Boolean)
}

function mapResult(r, photoUrl = null) {
  const loc = r.geometry?.location || {}
  const addr = r.formatted_address || r.vicinity || ""
  return {
    id: r.place_id,
    google_place_id: r.place_id,
    name: r.name || "Unknown Studio",
    address: addr,
    city: extractCity(addr),
    country: extractCountry(addr),
    lat: loc.lat || null,
    lng: loc.lng || null,
    rating: r.rating || 0,
    reviews: r.user_ratings_total || 0,
    tags: inferTags(r.name),
    types: inferTags(r.name),
    verified: false,
    hero: "🪷",
    heroPhoto: photoUrl,
    photos: photoUrl ? [photoUrl] : [],
    vibe: "",
    website: "",
    phone: "",
    distance: "",
    fromGoogle: true,
  }
}

function mapDetail(r, placeId, photoUrls = []) {
  const loc = r.geometry?.location || {}
  const addr = r.formatted_address || ""
  const iconUrl = r.icon || null
  return {
    id: placeId,
    google_place_id: placeId,
    name: r.name || "Unknown Studio",
    address: addr,
    city: extractCity(addr),
    country: extractCountry(addr),
    lat: loc.lat || null,
    lng: loc.lng || null,
    rating: r.rating || 0,
    reviews: r.user_ratings_total || 0,
    tags: inferTags(r.name),
    types: inferTags(r.name),
    verified: false,
    hero: "🪷",
    heroPhoto: photoUrls[0] || iconUrl || null,
    photos: photoUrls,
    iconUrl,
    vibe: r.opening_hours?.weekday_text?.slice(0, 3).join(" · ") || "",
    website: r.website || "",
    phone: r.formatted_phone_number || "",
    google_maps_url: r.url || "",
    distance: "",
    fromGoogle: true,
    opening_hours: r.opening_hours
      ? {
          open_now: r.opening_hours.open_now ?? null,
          weekday_text: r.opening_hours.weekday_text || [],
          periods: r.opening_hours.periods || [],
        }
      : null,
  }
}

function inferTags(name = "") {
  const n = name.toLowerCase()
  const tags = []
  if (n.includes("reformer")) tags.push("Reformer")
  if (n.includes("mat"))      tags.push("Mat")
  if (n.includes("hot"))      tags.push("Hot Pilates")
  if (n.includes("privat"))   tags.push("Private")
  if (n.includes("group"))    tags.push("Group")
  if (n.includes("tower"))    tags.push("Tower")
  if (n.includes("barre"))    tags.push("Barre")
  if (tags.length === 0)      tags.push("Reformer", "Mat")
  return tags
}

function extractCity(address) {
  if (!address) return ""
  const parts = address.split(",").map(s => s.trim())
  if (parts.length >= 3) {
    return parts[parts.length - 3].replace(/\s+[A-Z]{2}\s+\d{5}.*/, "").trim()
  }
  return parts[0] || ""
}

function extractCountry(address) {
  if (!address) return ""
  const parts = address.split(",").map(s => s.trim())
  return parts[parts.length - 1] || ""
}
