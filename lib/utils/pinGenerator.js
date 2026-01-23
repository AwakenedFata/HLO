import PinCode from "@/lib/models/pinCode"

// Characters used for PIN generation - avoiding similar looking characters
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Removed 0, O, 1, I

/**
 * Generates a random PIN code with the specified length
 * @param {number} length - Length of the PIN to generate (default 16)
 * @returns {string} Random PIN code
 */
export const generateRandomPin = (length = 16) => {
  let result = ""
  const charsLength = CHARS.length

  // Use a more efficient loop
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * charsLength))
  }

  return result
}

/**
 * Generates a unique PIN code that doesn't exist in the database
 * @param {string} prefix - Optional prefix for the PIN
 * @param {number} length - Length of the PIN (default 16, excluding prefix)
 * @returns {Promise<string>} Unique PIN code
 */
export const generateUniquePin = async (prefix = "", length = 16) => {
  // Maximum attempts to find a unique PIN
  const maxAttempts = 10
  let attempts = 0
  let pin

  // Calculate actual random part length
  const randomPartLength = length - prefix.length

  // Try to generate a unique PIN with limited attempts
  while (attempts < maxAttempts) {
    // Generate a random PIN
    pin = prefix + generateRandomPin(randomPartLength)

    // Check if PIN already exists - use lean() for better performance
    const existingPin = await PinCode.findOne({ code: pin }).lean()

    // If PIN doesn't exist, return it
    if (!existingPin) {
      return pin
    }

    attempts++
  }

  // If we couldn't generate a unique PIN after maxAttempts, try with a longer length
  return generateUniquePin(prefix, length + 1)
}

/**
 * Generates multiple unique PINs in a batch (more efficient than individual calls)
 * @param {number} count - Number of PINs to generate
 * @param {string} prefix - Optional prefix for the PINs
 * @param {number} length - Length of the PINs (default 16, excluding prefix)
 * @returns {Promise<string[]>} Array of unique PIN codes
 */
export const generateUniquePins = async (count, prefix = "", length = 16) => {
  // Get existing PINs with the same prefix to check against
  const existingPinDocs = await PinCode.find({ code: { $regex: `^${prefix}` } }, { code: 1, _id: 0 }).lean()

  // Create a Set for faster lookups
  const existingPins = new Set(existingPinDocs.map((doc) => doc.code))

  // Calculate actual random part length
  const randomPartLength = length - prefix.length

  // Generate pins
  const pins = []
  const generatedPins = new Set()
  let attemptsPerPin = 0
  const maxAttemptsPerPin = 20

  while (pins.length < count && attemptsPerPin < maxAttemptsPerPin) {
    // Generate a batch of candidate PINs (generate more than needed to increase chances)
    const batchSize = Math.min(count * 2, 1000)
    const candidates = []

    for (let i = 0; i < batchSize; i++) {
      candidates.push(prefix + generateRandomPin(randomPartLength))
    }

    // Filter unique PINs
    for (const pin of candidates) {
      if (!existingPins.has(pin) && !generatedPins.has(pin)) {
        pins.push(pin)
        generatedPins.add(pin)

        if (pins.length >= count) {
          break
        }
      }
    }

    attemptsPerPin++
  }

  // If we couldn't generate enough unique PINs, try with a longer length
  if (pins.length < count) {
    const remainingCount = count - pins.length
    const additionalPins = await generateUniquePins(remainingCount, prefix, length + 1)
    pins.push(...additionalPins)
  }

  return pins
}