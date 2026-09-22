import bpy, json, struct, pathlib, sys, hashlib, argparse
from mathutils import Vector, Matrix
# Run with Blender 4.0.2: blender -b --python scripts/assets/build_z_anatomy.py -- SOURCE_DIR OUTPUT_DIR
parser=argparse.ArgumentParser()
parser.add_argument('source_dir',type=pathlib.Path)
parser.add_argument('output_dir',type=pathlib.Path)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
source=args.source_dir
out=args.output_dir
out.mkdir(parents=True,exist_ok=True)
expected={'SkeletalSystem100.fbx': '294a649765cd060a62a4095da52b9c8ef2d97769aa447e196448aa5f7d596dea', 'VisceralSystem100.fbx': '22b301c93327929c9a14ee582d1848b550a950376e221a6d1078c7256bb83d0e'}
for name,digest in expected.items():
 assert hashlib.sha256((source/name).read_bytes()).hexdigest()==digest, 'Unexpected source hash: '+name
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for name in expected:bpy.ops.import_scene.fbx(filepath=str(source/name))
names={'medial incisor':1,'lateral incisor':2,'canine':3,'first premolar':4,'second premolar':5,'first molar tooth':6,'second molar tooth':7}
selected=[]
for o in list(bpy.data.objects):
 n=o.name
 if o.type!='MESH':continue
 if n=='Gingiva' or n in ['Mandible','Maxilla.l','Maxilla.r']:
  selected.append(o)
 elif n.startswith(('Upper ','Lower ')) and n.endswith(('.l','.r')) and any(k in n for k in names):
  upper=n.startswith('Upper');right=n.endswith('.r');q=(1 if right else 2) if upper else (4 if right else 3)
  d=next(v for k,v in names.items() if k in n)
  o['fdi']=q*10+d;selected.append(o)
for o in selected:
 transform=o.matrix_world.copy();o.parent=None;o.matrix_world=transform;o.data=o.data.copy()
for o in list(bpy.data.objects):
 if o not in selected:bpy.data.objects.remove(o,do_unlink=True)
# Separate gingiva's independent upper/lower surfaces using connectivity, not an arbitrary cut.
g=bpy.data.objects['Gingiva'];bpy.ops.object.select_all(action='DESELECT');g.select_set(True);bpy.context.view_layer.objects.active=g
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
manifest={'format':'dkb-mesh-v1','license':'CC-BY-SA-4.0','upstream':'BodyParts3D / Z-Anatomy','sourceRevision':'6c7f9016bd5899ac8edafd31b9900c151df42ed6','displayUnits':'source metres converted to millimetres; not for measurement','structures':[],'missing':['third molars','pulp','canals','separate enamel/dentin volumes'],'changes':['dental subset extraction','rigid coordinate transform and metre-to-millimetre conversion','one Catmull-Clark subdivision for presentation','smooth normals','separate loose gingiva components','binary packing']}
blob=bytearray(); bounds=[]
def pack(values,typ):
 offset=len(blob);blob.extend(struct.pack('<'+str(len(values))+typ,*values));return {'offset':offset,'count':len(values),'type':typ}
for o in sorted(bpy.data.objects,key=lambda o:o.name):
 if o.type!='MESH':continue
 isgum=o.name.startswith('Gingiva');fdi=int(o.get('fdi',0));isbone=not isgum and not fdi
 # Convert the evaluated source pose once; source relationships stay intact.
 world=[o.matrix_world@v.co for v in o.data.vertices]; meanz=sum(v.z for v in world)/len(world)
 jaw='upper' if (fdi and fdi<30) or o.name.startswith('Maxilla') or (isgum and meanz>1.535) else 'lower'
 if isgum: print('gum component',o.name,len(world),meanz,jaw)
 mod=o.modifiers.new('Presentation subdivision','SUBSURF');mod.levels=1;mod.render_levels=1
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 mat=o.matrix_world.copy()
 for v in o.data.vertices:
  p=mat@v.co;v.co=(p.x*1000,(p.z-1.535)*1000,-(p.y+0.065)*1000)
 o.matrix_world=Matrix.Identity(4);o.data.update()
 for p in o.data.polygons:p.use_smooth=True
 o.data.calc_loop_triangles()
 pos=[];norm=[]
 for v in o.data.vertices:pos.extend(v.co);norm.extend(v.normal)
 groups=[];indices=[]
 for mi,m in enumerate(o.data.materials):
  start=len(indices)
  for t in o.data.loop_triangles:
   if t.material_index==mi:indices.extend(t.vertices)
  if len(indices)>start:groups.append({'start':start,'count':len(indices)-start,'material':m.name})
 item={'name':o.name,'fdi':fdi or None,'kind':'tooth' if fdi else 'gingiva' if isgum else 'bone','jaw':jaw,'positions':pack(pos,'f'),'normals':pack(norm,'f'),'indices':pack(indices,'I'),'groups':groups}
 manifest['structures'].append(item)
manifest['sourceFiles']=[{'name':n,'sha256':h,'url':'https://raw.githubusercontent.com/LluisV/Z-Anatomy/'+manifest['sourceRevision']+'/Resources/Models/FBX/'+n} for n,h in expected.items()]
manifest['binarySha256']=hashlib.sha256(blob).hexdigest()
manifest['publicationStatus']='local engineering candidate; no academic or persisted rights approval'
assert len([s for s in manifest['structures'] if s['fdi']])==28
assert len(manifest['structures'])==34
(out/'dentition.bin').write_bytes(blob)
(out/'dentition.json').write_text(json.dumps(manifest,indent=2))
print('EXPORT',len(manifest['structures']),len(blob))
