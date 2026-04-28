# Mission: TypeLearn

## What

A language learning application where users learn by typing what they hear.

Core loop: hear audio → read the expected result → type it → get instant feedback.

Currently implementing with Thai language data, designed to support any language.

## Why

Existing language apps focus on multiple choice or vocabulary flashcards.
This app builds typing muscle memory—the ability to produce text by ear,
not just recognize it from options.

The Common Voice corpus provides free, crowd-sourced audio-text pairs for
over 150 languages. This app turns that raw data into structured practice.

## Target Users

- Language learners who already know the alphabet and want to build productive skills
- People who have completed beginner courses and need listening/typing practice
- Teachers who want a tool for dictation exercises without grading overhead

## MVP

### Must-haves
1. Display a sentence from the audio
2. Play the audio file
3. On-screen keyboard with Thai script characters
4. Type text and check correctness
5. Show result (correct/incorrect)

### Cannot build yet
- User accounts or progress saving
- Docker files or deployment infrastructure
- Ratings or user feedback systems
- Multi-language switching
- Mobile responsive design

## Success Criteria

MVP is "done" when:
- A user can open the app, click audio, type what they hear, and get feedback
- The entire flow works with 100 exercises from the common_voice dataset
- No login or configuration required

## UI Design

Tailwind utility classes only — no custom CSS needed. Clean spacing with standard spacing scale (`p-6`, `mb-2`, `gap-4`).

### Layout (single page, centered column)

```
┌───────  max-w-lg mx-auto  ────────┐
│                                     │
│   text-4xl font-bold text-center   │
│   [Sentence: สวัสดีวัน]             │
│                                     │
│   text-sm text-gray-400 text-center │
│   [Length hint: ~15 chars]         │
│                                     │
│   bg-blue-600 hover:bg-blue-700     │
│  text-white px-4 py-2 rounded       │
│   [ ▶ Play audio ]                  │
│                                     │
│   border border-gray-300 rounded    │
│   p-3 text-lg bg-white             │
│   [ _____________________ ]         │
│                                     │
│   bg-white/10 rounded-lg            │
│   p-4                               │
│   [ keyboard rows of keys ]         │
│                                     │
│   bg-green-600 text-white           │
│   bg-red-600 text-white             │
│   bg-gray-600 text-white            │
│   [Check]  [Skip]  [Replay]         │
│                                     │
│   ✓ Correct → auto advance (green)  │
│   ✗ Incorrect (red)                 │
│     Expected: สวัสดีวัน              │
│     Try again                       │
└─────────────────────────────────────┘
```

- Background: `bg-gradient-to-br from-gray-900 to-gray-800` (dark) or `from-indigo-50 to-purple-50` (light)
- Content card: `bg-white/5 backdrop-blur rounded-2xl p-8 shadow-xl`
- Sentence: `text-4xl font-bold text-white tracking-wide leading-relaxed`
- Keyboard: `bg-white/10 backdrop-blur rounded-xl p-4`
- Keys: `bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg px-4 py-2 text-lg font-mono transition-colors`
- Active key (next): `ring-2 ring-white bg-white/20`
- Input: `bg-white/10 border-white/20 text-white placeholder-white/40 text-lg p-4 rounded-lg font-mono`
- Feedback: `font-semibold text-lg` — green (`text-green-400`) or red (`text-red-400`)
