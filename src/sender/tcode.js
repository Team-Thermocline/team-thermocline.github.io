/**
 * TCode packet construction utilities
 */

/**
 * Calculate XOR checksum for a string
 * @param {string} str - The string to calculate checksum for
 * @returns {string} - Two-digit hexadecimal checksum (uppercase)
 */
function calculateXORChecksum(str) {
  let checksum = 0;
  for (let i = 0; i < str.length; i++) {
    checksum ^= str.charCodeAt(i);
  }
  return checksum.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Wrap a command body with `*XX` checksum. (XOR of all chars)
 * @param {string} body
 * @returns {string}
 */
function withChecksum(body) {
  const checksum = calculateXORChecksum(body);
  return `${body}*${checksum}`;
}

/**
 * Construct a temperature command packet
 * Format: Z0 T<temp>*XX where XX is the hex XOR checksum
 * @param {number} temperature - The temperature value
 * @returns {string} - The complete command packet
 */
export function buildTemperatureCommand(temperature) {
  const tempStr = temperature.toString();
  const body = `Z0 T${tempStr}`;
  return withChecksum(body);
}

/**
 * Construct a query command packet.
 * @returns {string}
 */
export function buildQueryCommand() {
  return withChecksum("Q0");
}

/**
 * Validate a received tcode packet by checking its checksum
 * @param {string} packet - The received packet
 * @returns {boolean} - True if checksum is valid
 */
export function validatePacket(packet) {
  // Packet should end with *XX where XX is checksum
  const match = packet.match(/^(.+)\*([0-9A-Fa-f]{2})$/);
  if (!match) {
    return false;
  }
  
  const [, commandPart, receivedChecksum] = match;
  const calculatedChecksum = calculateXORChecksum(commandPart);
  
  return calculatedChecksum.toUpperCase() === receivedChecksum.toUpperCase();
}
