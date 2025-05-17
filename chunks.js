// script to run once during build/setup
const fs = require('fs');
const path = require('path');

// Read the wordlist file
const words = fs.readFileSync(path.join(__dirname, 'public/wordlists/words_alpha.txt'), 'utf8')
  .split('\n')
    .map(word => word.trim()) // This will remove whitespace including \r characters
      .filter(word => word.length > 0);

      // Create a map to store words by first letter
const wordsByLetter = {};

      // Group words by their first letter
      words.forEach(word => {
        const firstLetter = word.charAt(0).toLowerCase();
          if (!wordsByLetter[firstLetter]) {
              wordsByLetter[firstLetter] = [];
                }
                  wordsByLetter[firstLetter].push(word);
                  });

                  // Create directory if it doesn't exist
                  const chunksDir = path.join(__dirname, 'public/wordlist/chunks');
                  if (!fs.existsSync(chunksDir)) {
                    fs.mkdirSync(chunksDir, { recursive: true });
                    }

                    // Write each letter's words to a separate JSON file
                    Object.keys(wordsByLetter).forEach(letter => {
                      fs.writeFileSync(
                          path.join(chunksDir, `${letter}.json`),
                              JSON.stringify(wordsByLetter[letter])
                                );
                                });

                                console.log('Wordlist successfully chunked by first letter!');