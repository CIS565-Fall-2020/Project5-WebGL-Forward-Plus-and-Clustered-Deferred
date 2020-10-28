import shadelightfunction from './shadelight.glsl'

export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform vec3 u_view_pos;
  
  uniform float u_xSlice;
  uniform float u_ySlice;
  uniform float u_zSlice; 

  ${shadelightfunction}
  varying vec2 v_uv;
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    // vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    // vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    // vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    gl_FragColor = vec4(v_uv, 0.0, 1.0);
  }
  `;
}