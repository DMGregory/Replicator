/*
  Douglas Gregory - 219033117

  See public/index.html for overview of whole solution.
  These snippets are just small utility functions to help with printing data to a div for debugging,
  or generating a random colour hex string for the login form.
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