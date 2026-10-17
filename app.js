import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
const host = document.querySelector('#scene');
const canvas = document.querySelector('#hero-canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)');
let renderer,frame=0,visible=true,paused=reduced.matches,contextLost=false;
try {
  renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
  // Bound fragment work on Retina/4K screens; keep CSS size and camera framing.
  let qualityScale=1;
  const pixelBudget=coarse.matches?900000:1800000;
  function pixelRatio(width,height){return Math.min(devicePixelRatio,coarse.matches?1.1:1.25,Math.sqrt(pixelBudget/(width*height)))*qualityScale;}
  renderer.setClearColor(0xf5f5f7,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(34,1,.1,50);camera.position.set(0,0,9);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.025);
  scene.environment=environment.texture;
  room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0x64627d,.3));
  const light=new THREE.DirectionalLight(0xffffff,1.2);light.position.set(-3,5,5);scene.add(light);
  const fill=new THREE.DirectionalLight(0xa6a3ff,.7);fill.position.set(4,-2,3);scene.add(fill);
  // Studio glass: sample the prefiltered environment instead of refracting a
  // freshly rendered scene. transmission stays zero: no transmission target,
  // multisample resolve, mipmap generation or bicubic screen-space sampling.
  const blue=new THREE.MeshPhysicalMaterial({color:0x6240ff,metalness:0,roughness:.045,ior:1.62,clearcoat:1,clearcoatRoughness:.025,envMapIntensity:1.4});
  const chrome=new THREE.MeshPhysicalMaterial({color:0xf4f5ff,metalness:0,roughness:.025,ior:1.62,clearcoat:1,envMapIntensity:1.4});
  const dark=new THREE.MeshPhysicalMaterial({color:0x292a36,metalness:.45,roughness:.055,ior:1.52,clearcoat:1,envMapIntensity:1.5});
  const white=new THREE.MeshPhysicalMaterial({color:0xf2f3ff,metalness:0,roughness:.12,ior:1.45,clearcoat:1,envMapIntensity:1.1});
  [blue,chrome,dark,white].forEach((material,index)=>{
    const blend=index===2?.42:.86;
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        #ifdef ENVMAP_TYPE_CUBE_UV
          vec3 studioNormal = inverseTransformDirection(normal, viewMatrix);
          vec3 studioView = inverseTransformDirection(geometryViewDir, viewMatrix);
          vec3 studioRay = refract(-studioView, studioNormal, 1.0 / ior);
          vec3 studioGlass = textureCubeUV(envMap, envMapRotation * studioRay, roughnessFactor).rgb;
          float studioEdge = pow(1.0 - saturate(dot(normal, geometryViewDir)), 3.0);
          studioGlass *= mix(vec3(1.0), diffuseColor.rgb, 0.85 + 0.15 * studioEdge);
          outgoingLight = mix(outgoingLight, studioGlass, ${blend.toFixed(2)} * (1.0 - 0.6 * studioEdge)) + totalSpecular * 0.25;
        #endif
        #include <opaque_fragment>
      `);
    };
    material.customProgramCacheKey=()=> 'studio-glass-lite-v1-'+blend;
  });
  const root=new THREE.Group();scene.add(root);
  const items=[];
  function add(geometry,material,position,rotation,scale=1){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.scale.setScalar(scale);root.add(mesh);
    items.push({mesh,base:mesh.position.clone(),rotation:mesh.rotation.clone(),offset:new THREE.Vector3(),velocity:new THREE.Vector3(),seed:items.length*1.7});return mesh;
  }
  add(new THREE.TorusGeometry(.93,.29,24,72),blue,[.25,.25,.4],[.48,-.55,-.5],1.38);
  add(new THREE.SphereGeometry(.62,40,24),chrome,[-1.1,1.48,.3],[0,0,0]);
  add(new THREE.CapsuleGeometry(.28,1.2,8,24),blue,[1.5,1.53,-.35],[.4,.15,-.72]);
  add(new THREE.TorusGeometry(.48,.2,20,56),dark,[-1.4,-1.05,.35],[.5,.5,.4]);
  add(new THREE.OctahedronGeometry(.63,0),white,[1.55,-1.13,.1],[.2,.5,.4]);
  add(new THREE.SphereGeometry(.21,24,16),blue,[-1.48,-.06,1],[0,0,0]);
  add(new THREE.CapsuleGeometry(.15,.62,6,20),chrome,[.2,-1.76,.25],[.2,.4,1.05]);
  add(new THREE.SphereGeometry(.12,20,12),dark,[1.84,.05,.1],[0,0,0]);
  const mouse=new THREE.Vector2(10,10),pointerWorld=new THREE.Vector3(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
  let inside=false,rect,clock=0,idleClock=0,scrollTarget=0,last=0,disposed=false,metricTime=0,metricFrames=0;
  function resize(){stop();rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return;const wide=innerWidth>700;
    const sceneWidth=wide?rect.width*(innerWidth<=1100?.60:innerWidth>=1900?.50:.56):rect.width;
    const sceneLeft=wide?rect.width-sceneWidth+(innerWidth<=1100?0:innerWidth>=1900?-rect.width*.05:rect.width*.03):0;
    camera.position.z=wide?9:8.4;camera.aspect=sceneWidth/rect.height;
    if(wide)camera.setViewOffset(sceneWidth,rect.height,-sceneLeft,0,rect.width,rect.height);else camera.clearViewOffset();
    camera.updateProjectionMatrix();renderer.setPixelRatio(pixelRatio(rect.width,rect.height));renderer.setSize(rect.width,rect.height,false);root.scale.setScalar(wide?(sceneWidth<600?.84:1):Math.min(1.12,(2*8.4*Math.tan(17*Math.PI/180)*camera.aspect)/4.9));root.position.set(wide?0:-.06,wide?0:-.08,0);draw(performance.now());}
  function draw(now){
    frame=0;if(disposed||contextLost)return;
    if(!paused&&last&&now-last<(coarse.matches?1000/30:1000/60)-.5){frame=requestAnimationFrame(draw);return;}
    const elapsed=now-(last||now),dt=Math.min(elapsed/1000,.035);last=now;
    let changing=!paused;
    if(!paused) idleClock+=dt;
    if(!paused){const difference=scrollTarget*3-clock;clock+=difference*(1-Math.exp(-dt*7));changing=changing||Math.abs(difference)>.0001;}
    if(elapsed>0&&!paused){metricTime+=elapsed;metricFrames++;if(metricTime>=2000){
      const fps=metricFrames*1000/metricTime;
      canvas.dataset.fps=String(Math.round(fps));
      // Lower resolution gradually only under sustained load, without touching
      // animation speed, object placement or CSS layout. Avoid quality thrash.
      if(fps<(coarse.matches?24:45)&&qualityScale>.7){qualityScale=Math.max(.7,qualityScale-.1);renderer.setPixelRatio(pixelRatio(rect.width,rect.height));}
      canvas.dataset.pixelRatio=String(renderer.getPixelRatio());metricTime=0;metricFrames=0;
    }}
    ray.setFromCamera(mouse,camera);ray.ray.intersectPlane(plane,pointerWorld);
    items.forEach((item,i)=>{
      const dx=item.mesh.position.x-pointerWorld.x,dy=item.mesh.position.y-pointerWorld.y;
      const distance=Math.sqrt(dx*dx+dy*dy),strength=inside&&!paused?Math.max(0,1-distance/2.1)*1.25:0;
      const targetX=distance>.001?dx/distance*strength:0,targetY=distance>.001?dy/distance*strength:0;
      const blend=1-Math.exp(-dt*7);
      if(Math.abs(targetX-item.offset.x)+Math.abs(targetY-item.offset.y)>.0001)changing=true;
      item.offset.x+=(targetX-item.offset.x)*blend;item.offset.y+=(targetY-item.offset.y)*blend;
      item.mesh.position.set(item.base.x+item.offset.x+Math.sin(idleClock*.32+item.seed)*.055,item.base.y+item.offset.y+Math.sin(clock*.7+idleClock*.48+item.seed)*.12,item.base.z+Math.sin(clock+idleClock*.22+item.seed)*.1);
      item.mesh.rotation.set(item.rotation.x+Math.sin(clock*.35+idleClock*.28+item.seed)*.16,item.rotation.y+Math.sin(clock*.22+idleClock*.23+item.seed)*.32,item.rotation.z+Math.cos(clock*.35+idleClock*.3+item.seed)*.1);
    });
    const rotationTarget=(inside&&!paused?mouse.x*.095:0);
    if(Math.abs(rotationTarget-root.rotation.y)>.0001)changing=true;
    root.rotation.y+=( (inside&&!paused?mouse.x*.095:0)-root.rotation.y)*(1-Math.exp(-dt*3));
    renderer.render(scene,camera);host.classList.add('ready');canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);
    if(changing&&!paused&&visible&&!document.hidden&&!contextLost)frame=requestAnimationFrame(draw);
    host.dataset.rendering=frame?"active":"idle";
  }
  function start(){if(!frame&&!paused&&visible&&!document.hidden&&!contextLost&&!disposed){last=0;metricTime=0;metricFrames=0;frame=requestAnimationFrame(draw);}}
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;host.dataset.rendering="idle";}
  host.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||paused)return;rect=host.getBoundingClientRect();inside=true;mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);start();},{passive:true});
  host.addEventListener('pointerleave',()=>{inside=false;mouse.set(10,10);start();});
  function onScroll(){if(reduced.matches||paused)return;const hero=document.querySelector('.hero').getBoundingClientRect();scrollTarget=THREE.MathUtils.clamp(-hero.top/hero.height,0,1);start();}
  window.addEventListener('scroll',onScroll,{passive:true});
  const ro=new ResizeObserver(resize);ro.observe(host);
  const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();},{threshold:.01});io.observe(host);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});
  reduced.addEventListener('change',()=>{paused=reduced.matches;if(paused)stop();else start();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;stop();host.classList.remove('ready');});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  window.addEventListener('pagehide',event=>{stop();if(event.persisted)return;disposed=true;io.disconnect();ro.disconnect();items.forEach(i=>i.mesh.geometry.dispose());[blue,chrome,dark,white].forEach(m=>m.dispose());environment.dispose();renderer.dispose();});
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  resize();
} catch(error){console.warn('3D unavailable; showing typographic fallback.',error);}
