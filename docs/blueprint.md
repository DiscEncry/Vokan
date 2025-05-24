# **App Name**: Lexify

## Core Features:

- Vocabulary Input: Enables users to input new words and store it on their local device.
- Vocabulary Sorting: Sort words by multiple different factors.
- Interactive Cloze Exercise: AI-powered sentence generation featuring words the user inputs. Sentence is displayed in the form of a Cloze deletion, in order to quiz the user.
- AI Detail Panel: The AI tool crafts detailed information about a selected word, offering definitions, example sentences, Vietnamese translations, synonyms, antonyms, usage tips, and additional relevant facts to aid in comprehensive learning.
- Spaced Repetition System: Schedules word quizzes using the FSRS algorithm to help retain hard-earned vocabularly.

- Text Input Game: Users type in the word to test their knowledge of the word's spelling.
    - Hinting
        - As the user types the word, each letter is checked against the correct answer. For example, if the correct word is "never", typing "n" will highlight the letter green (correct so far). Typing "ne" will still be green (still correct). But if they type "neo", all the letters will turn red (indicating the input is now incorrect).
        - There will be a "Reveal Next Letter" button. When pressed, it shows the next correct letter in the word. This action will decrease the familiarity score for that word. The button disappears after one use (only one hint is allowed per word).




## Style Guidelines:

- Mobile-first responsive design, optimized for various screen sizes using CSS Grid/Flexbox.
- Clean and readable sans-serif font for optimal readability.
- A modern and clean design featuring flat colors.
- Accent color: Teal (#008080) to promote a sense of calm focus
- Simple, intuitive icons to represent actions and categories within the app.
- Subtle, non-distracting feedback animations for user interactions and correct answers.