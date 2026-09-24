# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

# ---- Dependencies ----
FROM base AS deps
# Needed by sharp (an optional dep pulled in for Next's image optimizer) on
# Alpine's musl libc.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# These get inlined into the client bundle by `next build`, so a missing one
# doesn't fail the build (this app has no env schema validation — an unset
# value just renders a placeholder), but it does bake in the wrong thing
# permanently. Supplied via --build-arg (Coolify: check "Build Variable?"
# for each). None of these are secret — they're all visible in the browser
# regardless of how they got there.
ARG NEXT_PUBLIC_TS_HOST
ARG NEXT_PUBLIC_LIVEBOARD_ID
ARG NEXT_PUBLIC_SPOTTER_MODEL_ID
ARG NEXT_PUBLIC_TAB_ID_OVERVIEW
ARG NEXT_PUBLIC_TAB_ID_CUSTOMER
ARG NEXT_PUBLIC_TAB_ID_PRODUCT
ARG NEXT_PUBLIC_TAB_ID_BALANCES
ARG NEXT_PUBLIC_BRAND_NAME
ARG NEXT_PUBLIC_SPOTTER_PERSONA_NAME
ARG NEXT_PUBLIC_SPOTTER_CARD_LABEL
ARG NEXT_PUBLIC_DEMO_USERS
ARG NEXT_PUBLIC_EMBED_CSS_URL
ARG NEXT_PUBLIC_ICON_SPRITE_URL
ARG NEXT_PUBLIC_FILTER_COL_REGION
ARG NEXT_PUBLIC_FILTER_COL_STATE
ARG NEXT_PUBLIC_FILTER_COL_DATE
ENV NEXT_PUBLIC_TS_HOST=$NEXT_PUBLIC_TS_HOST \
    NEXT_PUBLIC_LIVEBOARD_ID=$NEXT_PUBLIC_LIVEBOARD_ID \
    NEXT_PUBLIC_SPOTTER_MODEL_ID=$NEXT_PUBLIC_SPOTTER_MODEL_ID \
    NEXT_PUBLIC_TAB_ID_OVERVIEW=$NEXT_PUBLIC_TAB_ID_OVERVIEW \
    NEXT_PUBLIC_TAB_ID_CUSTOMER=$NEXT_PUBLIC_TAB_ID_CUSTOMER \
    NEXT_PUBLIC_TAB_ID_PRODUCT=$NEXT_PUBLIC_TAB_ID_PRODUCT \
    NEXT_PUBLIC_TAB_ID_BALANCES=$NEXT_PUBLIC_TAB_ID_BALANCES \
    NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME \
    NEXT_PUBLIC_SPOTTER_PERSONA_NAME=$NEXT_PUBLIC_SPOTTER_PERSONA_NAME \
    NEXT_PUBLIC_SPOTTER_CARD_LABEL=$NEXT_PUBLIC_SPOTTER_CARD_LABEL \
    NEXT_PUBLIC_DEMO_USERS=$NEXT_PUBLIC_DEMO_USERS \
    NEXT_PUBLIC_EMBED_CSS_URL=$NEXT_PUBLIC_EMBED_CSS_URL \
    NEXT_PUBLIC_ICON_SPRITE_URL=$NEXT_PUBLIC_ICON_SPRITE_URL \
    NEXT_PUBLIC_FILTER_COL_REGION=$NEXT_PUBLIC_FILTER_COL_REGION \
    NEXT_PUBLIC_FILTER_COL_STATE=$NEXT_PUBLIC_FILTER_COL_STATE \
    NEXT_PUBLIC_FILTER_COL_DATE=$NEXT_PUBLIC_FILTER_COL_DATE

RUN npm run build

# ---- Run ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# TS_SECRET_KEY / TS_ORG_ID / ANTHROPIC_API_KEY / TS_MCP_URL are runtime-only
# — real secrets and server config that must never land in a build arg or
# image layer (docker history would expose them). Supply them as regular
# container runtime env vars (Coolify's env var config, "Build Variable?"
# left unchecked). process.env is read fresh when the server process starts,
# so these take effect without anything set at build time.
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
