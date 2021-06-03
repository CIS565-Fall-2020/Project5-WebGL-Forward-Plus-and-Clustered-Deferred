export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_viewProjectionMatrix;
  uniform sampler2D u_lightbuffer;

  uniform float u_zDelta;

  uniform sampler2D u_clusterbuffer;

  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  varying vec2 v_uv;

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
  
 vec2 helper(vec2 v) {

	if(v.x >= 0.0){
		if(v.y >= 0.0){
			return vec2(1.0, 1.0);
		}else{
			return vec2(1.0, -1.0);
		}
	}else{
		if(v.y >= 0.0){
			return vec2(-1.0, 1.0);
		}else{
			return vec2(-1.0, -1.0);
		}
	}
}


  vec3 normToVec3(vec2 retVal) {
    vec3 v = vec3(retVal.xy, 1.0 - abs(retVal.x) - abs(retVal.y));
    if (v.z < 0.0) { 
      v.xy = (1.0 - abs(v.yx)) * helper(v.xy);
    }
    return normalize(v);
  }
  
  void main() {
    vec4 pos = texture2D(u_gbuffers[0], v_uv);
    vec4 col = texture2D(u_gbuffers[1], v_uv);
	
    vec3 position = vec3(pos);
    vec3 albedo = vec3(col);
    vec2 norm_2D = vec2(pos.w, col.w);

    vec3 normal = normToVec3(norm_2D);

    vec3 fragColor = vec3(0.0);

    int fovX = int(gl_FragCoord.x / float(${params.width}) * float(${params.numXSlices}));
    int fovY = int(gl_FragCoord.y / float(${params.height}) * float(${params.numYSlices}));
    int fovZ = int((u_viewMatrix * vec4(position, 1)).z / u_zDelta * float(${params.numZSlices}));
    int idx = fovX + fovY * ${params.numXSlices} + fovZ * ${params.numXSlices} * ${params.numYSlices};

    int texHeight = int(ceil(float(${params.numLights + 1}) / 4.0));

    int numLights = int(ExtractFloat(u_clusterbuffer, ${params.numClusters}, texHeight, idx, 0));

    for(int i = 0; i < ${params.numLights}; i++) {
      if(i >= numLights){
		  break;
	  }
	  
      int lightIdx = int(ExtractFloat(u_clusterbuffer, ${params.numClusters}, texHeight, idx, i + 1));
      Light currLight = UnpackLight(lightIdx);

      float lightDistance = distance(currLight.position, position);
      vec3 L = (currLight.position - position) / lightDistance;

      float lightIntensity = cubicGaussian(1.5 * lightDistance / currLight.radius);
      float lambertTerm = floor(max(dot(L, normal), 0.0) * 4.0) / 4.0;
      fragColor += albedo * lambertTerm * currLight.color * vec3(lightIntensity);

    }


    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}