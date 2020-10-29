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

  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  ${shadelightfunction}
  varying vec2 v_uv;
  //varying vec3 v_projection_position;
  


  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 v_position = texture2D(u_gbuffers[0], v_uv);
    vec4 normal = texture2D(u_gbuffers[1], v_uv);
    vec4 albedo = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);
    vec3 cluster_idx = p2ClusterIdx(v_position.xyz);

    normal = (normal + 1.0) / 2.0;
    gl_FragColor = vec4(normal.xyz, 1.0);
  }
  `;
}