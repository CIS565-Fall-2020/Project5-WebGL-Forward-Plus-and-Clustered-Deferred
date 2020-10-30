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

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    // TODO: populate your g buffer
norm = norm / 2.0 + 0.5;
/*
// optimize 1 -- Use 2-component normals and reduce number of properties passed via g-buffer
	gl_FragData[0] = vec4(norm.xy, 0.0, v_position.z);
	gl_FragData[1] = vec4(col.xyz, 0.0);
*/
// optimize 2 -- Use 3-component normals and reduce number of properties passed via g-buffer
	gl_FragData[0] = vec4(norm.xy, 0.0,v_position.z);
	gl_FragData[1] = vec4(col.xyz, 0.0);

}