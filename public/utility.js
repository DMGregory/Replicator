function vectorToString(v) {
    return `(${v.x}, ${v.y}, ${v.z})`;
}  

let toPrint = '';
function print(text) {
  toPrint += text + '<br/>';
}

function showReadout(readout) {
    readout.innerHTML = toPrint;
    toPrint = '';
}