import { defineStore } from 'pinia'
import { ref } from 'vue'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/graphql/'

const EXERCISE_QUERY = `
  query Exercise {
    exercises(limit: 1) {
      id
      sentence
      audioUrl
      difficulty
    }
  }
`

export const useExerciseStore = defineStore('exercise', () => {
  const current = ref(null)
  // 'loading' | 'ready' | 'error' | 'empty' — what the view renders.
  const status = ref('loading')

  async function load() {
    status.value = 'loading'

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: EXERCISE_QUERY }),
      })

      if (!response.ok) {
        throw new Error(`The backend responded ${response.status}`)
      }

      const body = await response.json()

      // A GraphQL error arrives as HTTP 200 with an `errors` array, so checking
      // response.ok alone would report success on a broken query.
      if (body.errors?.length) {
        throw new Error(body.errors[0].message)
      }

      const [exercise] = body.data.exercises
      current.value = exercise ?? null
      status.value = exercise ? 'ready' : 'empty'
    } catch (error) {
      console.error('Could not load an exercise:', error)
      current.value = null
      status.value = 'error'
    }
  }

  return { current, status, load }
})
