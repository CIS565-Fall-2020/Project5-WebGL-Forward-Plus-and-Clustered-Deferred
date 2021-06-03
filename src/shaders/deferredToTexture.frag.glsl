#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
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

vec2 vec3ToNorm(vec3 v) {
    vec2 p = v.xy * (1.0 / (abs(v.x) + abs(v.y) + abs(v.z)));
	
	if(v.z >= 0.0){
		return p;
	}else{
		return (1.0 - abs(p.yx)) * helper(p);

	}
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    vec2 Norm_2D = vec3ToNorm(norm);

    // populate g-buffers
    gl_FragData[0] = vec4(v_position, Norm_2D.x);
    gl_FragData[1] = vec4(col, Norm_2D.y);

}