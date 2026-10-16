/* Local procedural keycap; loaded only near its card. No model, video or shadow maps. */
const host = document.querySelector('.keycap-scene');
if (host) {
  const card = host.closest('.process-poster');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let started = false;
  const lazy = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting) || started) return;
    started = true; lazy.disconnect();
    build().catch(error => { host.dataset.rendering = 'fallback'; console.warn('Keycap uses its static fallback.', error); });
  }, { rootMargin: '350px' });
  lazy.observe(card);

  async function build() {
    const THREE = await import('./vendor/three.module.js');
    const canvas = host.querySelector('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 30);
    camera.position.z = 7.8;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new THREE.Scene();
    room.background = new THREE.Color().setRGB(.035,.035,.035);
    const panels=[];
    [[1.1,6,-3,1,3],[.65,5,4,.5,2],[5,.7,0,5,2],[3,.4,-1,-3,4],[4,1,0,2,-4],[1.1,5,-4,-3,1],[.8,4,3,-3,1]].forEach(([w,h,x,y,z])=>{
      const material=new THREE.MeshBasicMaterial({color:new THREE.Color(4,4,4),side:THREE.DoubleSide});
      const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);
      panel.position.set(x,y,z);panel.lookAt(0,0,0);room.add(panel);panels.push(panel);
    });
    const environment = pmrem.fromScene(room, .035);
    scene.environment = environment.texture;
    panels.forEach(p=>{p.geometry.dispose();p.material.dispose();});pmrem.dispose();
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(-3, 5, 6); scene.add(light);
    const edge = new THREE.DirectionalLight(0xffffff, 2);
    edge.position.set(4, -2, 2); scene.add(edge);

    // Rounded contours form the tapered shell, rolled lip and shallow concave top.
    const profiles = [
      [1.27,1.17,.24,-.59], [1.4,1.3,.29,-.56], [1.46,1.35,.31,-.45],
      [1.45,1.34,.30,-.29], [1.34,1.23,.27,.06], [1.21,1.10,.24,.34],
      [1.17,1.06,.23,.43], [1.12,1.01,.22,.47], [1.07,.96,.20,.45],
      [1.02,.91,.19,.39], [.96,.85,.18,.34], [.78,.68,.16,.30], [.3,.26,.1,.29]
    ];
    const vertices = [], indices = [], segments = 64;
    profiles.forEach(([w,h,r,z]) => {
      [[w-r,h-r],[-w+r,h-r],[-w+r,-h+r],[w-r,-h+r]].forEach(([x,y], corner) => {
        for (let j=0; j<16; j++) {
          const angle = (corner + j/15) * Math.PI/2;
          vertices.push(x+r*Math.cos(angle), y+r*Math.sin(angle), z);
        }
      });
    });
    for (let ring=0; ring<profiles.length-1; ring++) {
      for (let j=0; j<segments; j++) {
        const a=ring*segments+j,b=ring*segments+(j+1)%segments,c=b+segments,d=a+segments;
        indices.push(a,b,d,b,c,d);
      }
    }
    const centre=vertices.length/3;vertices.push(0,0,.29);
    for(let j=0;j<segments;j++) indices.push((profiles.length-1)*segments+j,(profiles.length-1)*segments+(j+1)%segments,centre);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const shellCount=9*segments*6;
    geometry.addGroup(0,shellCount,0);geometry.addGroup(shellCount,indices.length-shellCount,1);
    const chrome = new THREE.MeshPhysicalMaterial({ color:0x8d9297, metalness:1, roughness:.085, envMapIntensity:1.5, clearcoat:1, clearcoatRoughness:.08 });
    const top = new THREE.MeshPhysicalMaterial({ color:0x030405, metalness:.78, roughness:.16, envMapIntensity:.5, clearcoat:1, clearcoatRoughness:.05 });
    const key = new THREE.Group();
    const mesh = new THREE.Mesh(geometry,[chrome,top]); key.add(mesh); scene.add(key);

    // A small local canvas keeps the legend crisp without a font or texture download.
    const labelCanvas = document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=192;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle='#f3f3f3';ctx.font='300 116px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('esc',233,96);
    ctx.font='24px Arial';ctx.fillText('®',357,83);
    const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;
    const labelMaterial=new THREE.MeshBasicMaterial({map:labelTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    const labelGeometry=new THREE.PlaneGeometry(1.2,.45);
    const label=new THREE.Mesh(labelGeometry,labelMaterial);label.position.set(0,-.43,.327);key.add(label);

    let frame=0,last=0,elapsed=0,visible=false,lost=false,disposed=false,draws=0;
    function pose() {
      key.rotation.set(-.58+Math.sin(elapsed*.65)*.055, -.38+Math.sin(elapsed*.45)*.16, .35+Math.cos(elapsed*.4)*.035);
      key.position.y=Math.sin(elapsed*.6)*.045;
    }
    function draw() {
      if (disposed || lost || document.hidden) return;
      pose();renderer.render(scene,camera);host.classList.add('is-ready');
      canvas.dataset.draws=String(++draws);
    }
    function tick(now) {
      frame=0;
      if (!visible || document.hidden || reduced.matches || lost || disposed) return;
      if(now-last>=1000/30-1){elapsed+=Math.min((now-last)/1000,.05);last=now;draw();}
      frame=requestAnimationFrame(tick);
    }
    function stop(){cancelAnimationFrame(frame);frame=0;host.dataset.rendering='idle';}
    function sync(){
      const rect=card.getBoundingClientRect(),next=card.nextElementSibling?.getBoundingClientRect();
      visible=rect.bottom>0&&rect.top<innerHeight&&(!next||next.top>Math.max(rect.top,0)+60);
      if(!visible||document.hidden||reduced.matches||lost||disposed){stop();return;}
      if(!frame){last=performance.now();host.dataset.rendering='active';frame=requestAnimationFrame(tick);}
    }
    function resize(){
      const {width,height}=host.getBoundingClientRect();if(!width||!height||disposed)return;
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
      const mobile=width<600;
      key.scale.setScalar(mobile?.62:1.13);
      key.position.x=mobile?0:camera.aspect*.26;
      draw();sync();
    }
    const ro=new ResizeObserver(resize);ro.observe(host);
    const io=new IntersectionObserver(sync);io.observe(card);
    addEventListener('scroll',sync,{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&reduced.matches)draw();sync();});
    reduced.addEventListener('change',()=>{draw();sync();});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;stop();host.classList.remove('is-ready');});
    canvas.addEventListener('webglcontextrestored',()=>{lost=false;resize();});
    addEventListener('pagehide',event=>{
      stop();if(event.persisted)return;disposed=true;ro.disconnect();io.disconnect();
      geometry.dispose();chrome.dispose();top.dispose();labelGeometry.dispose();labelMaterial.dispose();labelTexture.dispose();environment.dispose();renderer.dispose();
    });
    addEventListener('pageshow',()=>sync());
    host.dataset.triangles=String(indices.length/3+2);host.dataset.maxFps='30';
    resize();
  }
}
