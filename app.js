import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
const host = document.querySelector('#scene');
const canvas = document.querySelector('#hero-canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)');
let renderer,frame=0,visible=true,paused=reduced.matches,contextLost=false,ready=false;
try {
  renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,coarse.matches?1.5:1.75));
  renderer.setClearColor(0xf5f5f7,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.06;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(34,1,.1,50);camera.position.set(0,0,9);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.025);
  scene.environment=environment.texture;
  room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0x777989,.36));
  const light=new THREE.DirectionalLight(0xffffff,1.2);light.position.set(-3,5,5);scene.add(light);
  const fill=new THREE.DirectionalLight(0xa6a3ff,.7);fill.position.set(4,-2,3);scene.add(fill);
  // Physical transmission and thick coloured glass, sharing the existing environment.
  const blue=new THREE.MeshPhysicalMaterial({color:0x9b8cff,metalness:0,roughness:.045,transmission:.98,thickness:1.15,ior:1.62,attenuationColor:0x4030ff,attenuationDistance:1.6,clearcoat:1,clearcoatRoughness:.025,envMapIntensity:1.4});
  const chrome=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.025,transmission:.98,thickness:1.2,ior:1.62,clearcoat:1,envMapIntensity:1.4});
  const dark=new THREE.MeshPhysicalMaterial({color:0x454652,metalness:.45,roughness:.055,transmission:.55,thickness:.85,ior:1.52,attenuationColor:0x242631,attenuationDistance:.7,clearcoat:1,envMapIntensity:1.5});
  const white=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.12,transmission:.7,thickness:.85,ior:1.45,clearcoat:1,envMapIntensity:1.1});
  // Refract the shared studio environment as well as nearby objects; no extra render passes.
  [blue,chrome,dark,white].forEach(material=>{
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_pars_fragment>',THREE.ShaderChunk.transmission_pars_fragment.replace(
        'vec3 attenuatedColor = transmittance * transmittedLight.rgb;',
        'vec3 studioRefraction = textureCubeUV(envMap, refract(-v, n, 1.0 / ior), roughness).rgb; transmittedLight.rgb = mix(transmittedLight.rgb, studioRefraction, 0.78); transmittedLight.a = 1.0; vec3 attenuatedColor = transmittance * transmittedLight.rgb;'
      ));
    };
    material.customProgramCacheKey=()=> 'studio-glass-v1';
  });
  const root=new THREE.Group();scene.add(root);
  const items=[];
  function add(geometry,material,position,rotation,scale=1){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.scale.setScalar(scale);root.add(mesh);
    items.push({mesh,base:mesh.position.clone(),rotation:mesh.rotation.clone(),offset:new THREE.Vector3(),velocity:new THREE.Vector3(),seed:items.length*1.7});return mesh;
  }
  add(new THREE.TorusGeometry(.93,.29,32,96),blue,[.25,.25,.4],[.48,-.55,-.5],1.38);
  add(new THREE.SphereGeometry(.62,48,32),chrome,[-1.1,1.48,.3],[0,0,0]);
  add(new THREE.CapsuleGeometry(.28,1.2,12,32),blue,[1.5,1.53,-.35],[.4,.15,-.72]);
  add(new THREE.TorusGeometry(.48,.2,24,64),dark,[-1.4,-1.05,.35],[.5,.5,.4]);
  add(new THREE.OctahedronGeometry(.63,0),white,[1.55,-1.13,.1],[.2,.5,.4]);
  add(new THREE.SphereGeometry(.21,24,16),blue,[-1.48,-.06,1],[0,0,0]);
  add(new THREE.CapsuleGeometry(.15,.62,6,20),chrome,[.2,-1.76,.25],[.2,.4,1.05]);
  add(new THREE.SphereGeometry(.12,20,12),dark,[1.84,.05,.1],[0,0,0]);
  const mouse=new THREE.Vector2(10,10),pointerWorld=new THREE.Vector3(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
  const touchOrigin=new THREE.Vector3(),touchLocal=new THREE.Vector3(),touchTarget=new THREE.Vector3(),touchOffset=new THREE.Vector3();
  let touchPointer=null,dragItem=null;
  let inside=false,rect,clock=0,idleClock=0,scrollTarget=0,last=0,disposed=false,metricTime=0,metricFrames=0;
  function resize(){stop();rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return;const wide=innerWidth>700;
    const sceneWidth=wide?rect.width*(innerWidth<=1100?.60:innerWidth>=1900?.50:.56):rect.width;
    const sceneLeft=wide?rect.width-sceneWidth+(innerWidth<=1100?0:innerWidth>=1900?-rect.width*.05:rect.width*.03):0;
    camera.position.z=wide?9:8.4;camera.aspect=sceneWidth/rect.height;
    if(wide)camera.setViewOffset(sceneWidth,rect.height,-sceneLeft,0,rect.width,rect.height);else camera.clearViewOffset();
    camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height,false);root.scale.setScalar(wide?(sceneWidth<600?.84:1):Math.min(1.26,(2*8.4*Math.tan(17*Math.PI/180)*camera.aspect)/4.65));root.position.set(wide?0:-.06,wide?0:-.08,0);if(ready)draw(performance.now());}
  function draw(now){
    frame=0;if(!ready||disposed||contextLost)return;
    // Render on every display refresh. A fixed 60/30 FPS gate skipped frames
    // unevenly on variable-refresh / ProMotion screens.
    const elapsed=now-(last||now),dt=Math.min(elapsed/1000,.035);last=now;
    let changing=!paused;
    if(!paused) idleClock+=dt;
    if(!paused){const difference=scrollTarget*3-clock;clock+=difference*(1-Math.exp(-dt*7));changing=changing||Math.abs(difference)>.0001;}
    if(elapsed>0&&!paused){metricTime+=elapsed;metricFrames++;if(metricTime>=1000){canvas.dataset.fps=String(Math.round(metricFrames*1000/metricTime));canvas.dataset.pixelRatio=String(renderer.getPixelRatio());metricTime=0;metricFrames=0;}}
    if(inside){ray.setFromCamera(mouse,camera);ray.ray.intersectPlane(plane,pointerWorld);}
    if(dragItem){
      touchLocal.copy(pointerWorld);root.worldToLocal(touchLocal);
      touchTarget.copy(touchLocal).sub(touchOrigin).add(touchOffset);
      touchTarget.z=0;touchTarget.clampLength(0,.45);
    }
    items.forEach((item,i)=>{
      const dx=item.mesh.position.x-pointerWorld.x,dy=item.mesh.position.y-pointerWorld.y;
      const distance=Math.sqrt(dx*dx+dy*dy),strength=inside&&!paused&&touchPointer===null?Math.max(0,1-distance/2.1)*1.25:0;
      const targetX=item===dragItem?touchTarget.x:distance>.001?dx/distance*strength:0,targetY=item===dragItem?touchTarget.y:distance>.001?dy/distance*strength:0;
      const blend=1-Math.exp(-dt*7);
      if(Math.abs(targetX-item.offset.x)+Math.abs(targetY-item.offset.y)>.0001)changing=true;
      item.offset.x+=(targetX-item.offset.x)*blend;item.offset.y+=(targetY-item.offset.y)*blend;
      item.mesh.position.set(item.base.x+item.offset.x+Math.sin(idleClock*.32+item.seed)*.055,item.base.y+item.offset.y+Math.sin(clock*.7+idleClock*.48+item.seed)*.12,item.base.z+Math.sin(clock+idleClock*.22+item.seed)*.1);
      item.mesh.rotation.set(item.rotation.x+Math.sin(clock*.35+idleClock*.28+item.seed)*.16,item.rotation.y+Math.sin(clock*.22+idleClock*.23+item.seed)*.32,item.rotation.z+Math.cos(clock*.35+idleClock*.3+item.seed)*.1);
    });
    const rotationTarget=(inside&&!paused&&touchPointer===null?mouse.x*.095:0);
    if(Math.abs(rotationTarget-root.rotation.y)>.0001)changing=true;
    root.rotation.y+=(rotationTarget-root.rotation.y)*(1-Math.exp(-dt*3));
    renderer.render(scene,camera);host.classList.add('ready');
    if(changing&&!paused&&visible&&!document.hidden&&!contextLost)frame=requestAnimationFrame(draw);
    host.dataset.rendering=frame?"active":"idle";
  }
  function start(){if(ready&&!frame&&!paused&&visible&&!document.hidden&&!contextLost&&!disposed){last=0;metricTime=0;metricFrames=0;frame=requestAnimationFrame(draw);}}
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;host.dataset.rendering="idle";}
  function movePointer(e){rect=host.getBoundingClientRect();inside=true;mouse.set(THREE.MathUtils.clamp((e.clientX-rect.left)/rect.width*2-1,-1,1),THREE.MathUtils.clamp(-(e.clientY-rect.top)/rect.height*2+1,-1,1));start();}
  function releaseTouch(){
    const pointer=touchPointer;touchPointer=null;dragItem=null;inside=false;mouse.set(10,10);
    if(pointer!==null&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
    start();
  }
  host.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'||paused||!ready)return;
    if(!e.isPrimary){releaseTouch();return;}
    movePointer(e);root.updateWorldMatrix(true,true);ray.setFromCamera(mouse,camera);
    const hit=ray.intersectObjects(root.children,false)[0];
    if(!hit){inside=false;return;}
    dragItem=items.find(item=>item.mesh===hit.object);touchPointer=e.pointerId;
    ray.ray.intersectPlane(plane,pointerWorld);
    touchOrigin.copy(pointerWorld);root.worldToLocal(touchOrigin);touchOffset.copy(dragItem.offset);
    canvas.setPointerCapture(e.pointerId);
  },{passive:true});
  host.addEventListener('pointermove',e=>{if(paused)return;if(e.pointerType==='mouse'&&touchPointer===null||e.pointerId===touchPointer)movePointer(e);},{passive:true});
  // Keep native vertical scrolling; the browser cancels the drag when a swipe becomes a scroll.
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>host.addEventListener(type,e=>{if(e.pointerId===touchPointer)releaseTouch();},{passive:true}));
  host.addEventListener('pointerleave',()=>{if(touchPointer===null){inside=false;mouse.set(10,10);start();}});
  function onScroll(){if(reduced.matches||paused)return;const hero=document.querySelector('.hero').getBoundingClientRect();scrollTarget=THREE.MathUtils.clamp(-hero.top/hero.height,0,1);start();}
  window.addEventListener('scroll',onScroll,{passive:true});
  const ro=new ResizeObserver(resize);ro.observe(host);
  const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();},{threshold:.01});io.observe(host);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseTouch();stop();}else start();});
  reduced.addEventListener('change',()=>{paused=reduced.matches;if(paused){releaseTouch();stop();}else start();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;stop();host.classList.remove('ready');});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  window.addEventListener('pagehide',event=>{stop();if(event.persisted)return;disposed=true;io.disconnect();ro.disconnect();items.forEach(i=>i.mesh.geometry.dispose());[blue,chrome,dark,white].forEach(m=>m.dispose());environment.dispose();renderer.dispose();});
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  resize();
  // Compile glass shaders before animation starts, avoiding a first-motion hitch.
  renderer.compileAsync(scene,camera).then(()=>{if(!disposed){ready=true;resize();}}).catch(error=>{console.warn('Shader prewarm unavailable; using regular compilation.',error);if(!disposed){ready=true;resize();}});
} catch(error){console.warn('3D unavailable; showing typographic fallback.',error);}
