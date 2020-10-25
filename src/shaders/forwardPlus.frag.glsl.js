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
  uniform float u_xSlice;
  uniform float u_ySlice;
  uniform float u_zSlice; 

  uniform vec3 u_view_pos;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;
  varying vec3 v_projection_position;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

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

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  vec3 position2CluterIdx(vec3 p ){
    // p is in model space
    vec3 o = vec3(0.0);


    return o;
  }

  vec3 myreflect(vec3 n, vec3 l){
    vec3 l_x = l - dot(l, n);
    return l - 2.0 * l_x;
  }

  vec3 p2ClusterIdx(vec3 proj_p){
    // get correspoinding cluster idx from projection
    // space position

    // NDC space is [-1, 1]
    // clamp to [0, 2] and mess with slice 
    proj_p += vec3(1.0);
    vec3 size_per_slice =vec3(2.0) / vec3( u_xSlice, u_ySlice, u_zSlice);
    
    return floor(proj_p / size_per_slice);
  }

  vec3 shader(vec3 albedo, vec3 normap, vec3 normal){
    vec3 fragColor = vec3(0.0);
    // specular constant
    float k_s = 0.75,shiness = 64.0;

    // ${params.numLights} 憨憨webGL
    for (int i = 0; i < ${params.numLights}; ++i) {
      
      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      // Phong Specular
      vec3 V = normalize( u_view_pos - v_position );
      vec3 H = normalize( L + V );
      vec3 R = normalize(myreflect(normal, light.position - v_position));
      // intensity of specular
      // blinn phong
      //float specularTerm = max(dot(H, normal), 0.0);
      // vanilla phong
      float specularTerm = max(dot(V, R), 0.0);
      float i_s = pow(specularTerm, shiness);
      
      fragColor +=  k_s * i_s * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    return fragColor;
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 cluster_idx = p2ClusterIdx(v_projection_position);

    vec3 fragColor = vec3(0.0);
    
    fragColor = shader(albedo, normap, normal);

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    //vec3 debug = ( normalize(u_view_pos - v_position) + 1.0 ) / 2.0 ;
    if (u_DEBUG == 1){
      vec3 slice_vec = vec3(u_xSlice, u_ySlice, u_zSlice) + vec3(1.0);
      gl_FragColor = vec4((cluster_idx + vec3(1.0) ) / slice_vec , 1.0);
    } else {
      gl_FragColor = vec4(fragColor, 1.0);
    }
    
  }
  `;
}
