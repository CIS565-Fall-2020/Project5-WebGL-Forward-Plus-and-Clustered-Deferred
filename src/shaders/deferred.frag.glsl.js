export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  varying vec2 v_uv;
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    vec3 albedo = (texture2D(u_gbuffers[0], v_uv)).xyz;
    vec3 normal = (texture2D(u_gbuffers[1], v_uv)).xyz;
    vec3 v_position = (texture2D(u_gbuffers[2], v_uv)).xyz;
    vec3 v_positionNonNDC = (texture2D(u_gbuffers[3], v_uv)).xyz;

    gl_FragColor = vec4(albedo, 1.0);
  }
  `;
}