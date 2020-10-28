import shaderlightfunction from './shadelight.glsl'

export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  // Jack12
  uniform mat4 u_projectionMatrix;

  uniform int u_DEBUG;
  uniform int u_maxLights;

  uniform float u_xSlice;
  uniform float u_ySlice;
  uniform float u_zSlice; 

  uniform vec3 u_view_pos;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;
  varying vec3 v_projection_position;

  ${shaderlightfunction}

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  vec3 NaiveShader(
    vec3 albedo, vec3 normap, vec3 normal,
    float k_s, float shiness
  ){
    vec3 fragColor = vec3(0.0);
    
    for (int i = 0; i < ${params.numLights}; ++i) {
      
      Light light = UnpackLight(i);
      fragColor += shaderLight(albedo, normap, normal, light, shiness, k_s, v_position);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    return fragColor;
  }

  vec3 ClusterShader(
    vec3 cluster_idx,
    vec3 albedo, vec3 normap, vec3 normal,
    float k_s, float shiness
  ){
    vec3 fragColor = vec3(0.0);
    int idx = int(cluster_idx.x + 
              cluster_idx.y * u_xSlice + 
              cluster_idx.z * u_xSlice * u_ySlice);

    int total_slice = int(u_xSlice * u_ySlice * u_zSlice);
    float clusterBufferIdx = float(idx + 1) / float(total_slice + 1);
    int numLights = int(texture2D(u_clusterbuffer, vec2(clusterBufferIdx, 0))[0]);
    // 
    
    int clusterSize = int(floor( (float(u_maxLights) + 1.0) / 4.0 + 1.0));
    // ${params.numLights} can loop over un-constant variables, WebGL属实憨憨
    for (int i = 0; i < ${params.numLights}; ++i) {
      if (i >= numLights){
        break;
      }
      int l_idx = int(ExtractFloat(
        u_clusterbuffer,
        total_slice,
        clusterSize,
        idx,
        i + 1
      ));
      Light light = UnpackLight(l_idx);
      fragColor += shaderLight(albedo, normap, normal, light, shiness, k_s, v_position);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    return fragColor;
  }

  vec4 vis_num_light(vec3 cluster_idx){
    vec3 fragColor = vec3(0.0);
    int idx = int(cluster_idx.x + 
              cluster_idx.y * u_xSlice + 
              cluster_idx.z * u_xSlice * u_ySlice);
    
    int total_slice = int(u_xSlice * u_ySlice * u_zSlice);
    float clusterBufferIdx = float(idx + 1) / float(total_slice + 1);
    int numLights = int(texture2D(u_clusterbuffer, vec2(clusterBufferIdx, 0))[0]);

    float percent = float(numLights) / float(u_maxLights);

    return vec4(vec3(percent), 1.0);
  }

  

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 cluster_idx = p2ClusterIdx(v_projection_position);

    // specular constant
    float k_s = 0.75,shiness = 64.0;
    vec3 fragColor = vec3(0.0);
    //fragColor = NaiveShader(albedo, normap, normal, k_s, shiness);
    fragColor += ClusterShader(cluster_idx, albedo, normap, normal, k_s, shiness);

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    //vec3 debug = ( normalize(u_view_pos - v_position) + 1.0 ) / 2.0 ;
    if (u_DEBUG == 2){
      gl_FragColor = vis_num_light(cluster_idx);
    }
    else if (u_DEBUG == 1){
      vec3 slice_vec = vec3(u_xSlice, u_ySlice, u_zSlice) + vec3(1.0);
      gl_FragColor = vec4((cluster_idx ) / slice_vec , 1.0);
      //gl_FragColor = vec4( vec2(cluster_idx) / vec2(slice_vec), 0.0, 1.0);
    } else {
      gl_FragColor = vec4(fragColor, 1.0);
    }
    
  }
  `;
}
