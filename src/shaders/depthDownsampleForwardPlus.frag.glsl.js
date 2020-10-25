export default function(params) {
	return `#version 310 es
	precision highp float;

	uniform sampler2D u_depth;

	in vec2 v_uv;

	void main() {
		ivec2 fragCoord = ivec2(gl_FragCoord.xy) * 2;
		float result = texelFetch(u_depth, fragCoord, 0).x;
		result = ${params.op}(result, texelFetch(u_depth, fragCoord + ivec2(1, 0), 0).x);
		result = ${params.op}(result, texelFetch(u_depth, fragCoord + ivec2(0, 1), 0).x);
		result = ${params.op}(result, texelFetch(u_depth, fragCoord + ivec2(1, 1), 0).x);
		gl_FragDepth = result;
	}
	`;
}
