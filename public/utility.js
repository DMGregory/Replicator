/* 
Basic utility functions to help with printing logs to a div, 
for data that's too spammy to log to the console.
Mostly used during debugging.
*/

function vectorToString(v) {
    return `(${v.x}, ${v.y}, ${v.z})`;
}  

// Accumulate text to display.
let toPrint = '';
function print(text) {
  toPrint += text + '<br/>';
}

// Display the text and clear the buffer for next frame.
function showReadout(readout) {
    readout.innerHTML = toPrint;
    toPrint = '';
}

// Generate a random RGB colour value as a hexadecimal string.
function randomColourHex() {
  const maxVal = 0xFFFFFF;
  const randomNumber = Math.random() * maxVal;         
  return Math.floor(randomNumber).toString(16);
}