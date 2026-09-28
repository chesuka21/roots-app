# SOUL.md - Project Identity & Architecture Context

## 1. Project Overview & Vision
This application is an AI-powered, graph-based language learning platform starting with English and designed for multi-language scalability. Unlike traditional flashcard tools, it structures vocabulary as an interconnected neural network where words form semantic and structural nodes, reinforcing retention through context, visual imagery, and spaced repetition.

- **Primary Goal:** Enable intuitive, high-retention vocabulary acquisition through context maps, speech synthesis, AI recommendations, and pattern mastery.
- **CI/CD Workflow:** Code changes are versioned on GitHub and automatically deployed to Vercel upon push.
- **Integrations:** Direct API capabilities for repository updates and continuous deployments.

---

## 2. Technical Stack & API Integrations

### Core Ecosystem
- **Frontend / Platform:** Web Application (React / Next.js) deployed on Vercel.
- **Version Control:** Git & GitHub integration.

### External APIs & Services
1. **Google Gemini API:** Generates simple definitions, contextual associations, slang/idiom explanations, personalized word recommendations based on onboarding preferences, and practice scenarios.
2. **Unsplash API:** Dynamically fetches relevant visual representations for targeted vocabulary terms.
3. **Edge TTS (Text-to-Speech):** Synthesizes natural audio pronunciation for target words, patterns, and contextual sentences.
4. **Graph Engine:** Renders an interactive, dynamic graph visualization (Obsidian-style network graph) mapping semantic connections between nodes (words/concepts).

---

## 3. Core Modules & Feature Architecture

### A. Graph View (Obsidian-Style Concept Map)
<Image src="image_agent_tag_7333160965614310971" alt="Interactive knowledge graph with nodes" caption="Visualización tipo Obsidian Graph View" />

- Interactive node network displaying connections between learned and targeted vocabulary.
- Visual representation of "neural links" between words based on shared categories, roots, synonyms, or contextual usage.

### B. Spaced Repetition System (SRS) & Practice
<Image src="image_agent_tag_7333160965614312668" alt="Flashcard repetition learning screen" caption="Módulo de Spaced Repetition y Flashcards" />

- Algorithmic review schedule calculating word retention strength.
- Multi-modal practice combining audio (Edge TTS), visual aids (Unsplash), and definition matching.

### C. Vocabulary Ingestion & AI Discovery
- **Onboarding Alignment:** Suggests words based on user interest profiles configured at setup.
- **Word Metadata Structure:**
  - Simple, clear definition.
  - Category / Part of speech.
  - Inter-word connections (graph nodes).
  - Dynamically generated visual image.
  - Audio pronunciation stream.

### D. Linguistic Patterns & Practice by Level
- Framework dedicated to frequent structural speech patterns (recurrent grammatical and colloquial constructs).
- Segmented by proficiency levels (A1 to C2).
- *Pending Architecture Goal:* Unify the general Patterns module directly with the Level-based Practice Patterns module for seamless progress tracking.

### E. Smart Lookup & Idiomatic Expressions
- **Descriptive Search:** Search for words by describing their concept or context when exact spelling is forgotten.
- **Local Slang & Idioms:** Specialized registry for colloquialisms, phrasal verbs, and context-dependent local expressions that lack literal translations.

### F. Gamification & Engagement Mechanics
- **Streak Tracker:** Consecutive active days system.
- **Experience Points (EXP) & Levels:** Dynamic progression scaled by practice volume and accuracy.
- **Points System:** In-app currency/reward metric for unlocking features or milestones.

---

## 4. UI/UX Refinement Goals (In Progress)
- Redesign interface components for improved aesthetic polish and visual hierarchy.
- Enhance iconography across all navigation menus and action triggers.
- Optimize image integration within word cards and graph overlays to make visual learning central to the UI.

---

## 5. Development Guidelines for Hermes / AI Agent
1. Maintain modular code structure ensuring API keys (Gemini, Unsplash, Edge TTS) are cleanly encapsulated in service layers or environment variables.
2. Preserve existing Git/GitHub branch conventions when issuing direct updates for Vercel auto-deploys.
3. Prioritize clear node metadata schemas when modifying graph functionality to avoid breaking node-link relationships.
