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
