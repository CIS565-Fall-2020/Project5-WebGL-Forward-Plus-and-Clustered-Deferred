export default function(params) {
  return `
  #version 100
  precision highp float;

  void main() {
    gl_FragColor = vec4(gl_FragCoord.z, gl_FragCoord.z, gl_FragCoord.z, 1.0);
  }
  `;
}