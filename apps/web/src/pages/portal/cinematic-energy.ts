// Optional low-resolution GPU energy layer. The existing canvas remains the fallback.
export function createCinematicEnergy() {
 const canvas=document.createElement('canvas');
 canvas.width=256;canvas.height=256;
 const gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
 if(!gl)return null;
 const shaders:WebGLShader[]=[];
 const compile=(kind:number,source:string)=>{const s=gl.createShader(kind);if(!s)throw Error('shader');shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('shader compile');return s;};
 let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null;
 const dispose=()=>{if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));};
 try{
 program=gl.createProgram();if(!program)throw Error('program');
 gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 p; varying vec2 uv; void main(){uv=p;gl_Position=vec4(p,0.,1.);}'));
 gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`precision mediump float; varying vec2 uv; uniform float t;
 void main(){float r=length(uv);float a=atan(uv.y,uv.x);float wave=sin(a*12.+t*2.+r*22.);float ring=exp(-abs(r-.66-wave*.025)*35.);float inner=exp(-abs(r-.43)*48.);float rays=pow(max(0.,sin(a*24.-t)),8.)*exp(-abs(r-.72)*12.);float fade=1.-smoothstep(.75,1.,r);vec3 col=vec3(.12,.95,.42)*ring+vec3(1.,.68,.19)*(inner+rays*.5);gl_FragColor=vec4(min(col,1.),clamp((ring+inner+rays*.5)*fade*.8,0.,1.));}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');
 buffer=gl.createBuffer();if(!buffer)throw Error('buffer');gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 const p=gl.getAttribLocation(program,'p'),t=gl.getUniformLocation(program,'t');gl.useProgram(program);gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
 return {canvas,draw(time:number){if(gl.isContextLost())return false;gl.viewport(0,0,256,256);gl.uniform1f(t,time);gl.drawArrays(gl.TRIANGLES,0,3);return !gl.isContextLost();},dispose};
 }catch{dispose();return null;}
}
