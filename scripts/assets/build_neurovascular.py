"""Extract named source surfaces, with no invented branches or tissue connections."""
import bpy, json, struct, pathlib, sys, hashlib, argparse
from mathutils import Matrix
parser=argparse.ArgumentParser()
parser.add_argument('source_dir',type=pathlib.Path)
parser.add_argument('output_dir',type=pathlib.Path)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
expected={'NervousSystem100.fbx': '3ea1aad64956cad27348a27b8fb50494b7cc307c6bc77bee0810ec2a67dff2b1', 'CardioVascular41.fbx': 'ed7d049117cc944a8c47a416b16ade642cbd1392bbcce3c677450d3234dbf680'}
revision='6c7f9016bd5899ac8edafd31b9900c151df42ed6'
labels={
 'Inferior alveolar nerve':('nerve','lower','Alt alveolar sinir'),
 'Mental nerve':('nerve','lower','Mental sinir'),
 'Maxillary nerve':('nerve','upper','Maksiller sinir'),
 'Inferior alveolar artery':('artery','lower','Alt alveolar atardamar'),
 'Mental branch of inferior alveolar artery':('artery','lower','Alt alveolar atardamarın mental dalı'),
 'Posterior superior alveolar artery':('artery','upper','Arka üst alveolar atardamar'),
 'Greater palatine artery':('artery','upper','Büyük damak atardamarı'),
}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for name,digest in expected.items():
 assert hashlib.sha256((args.source_dir/name).read_bytes()).hexdigest()==digest
 bpy.ops.import_scene.fbx(filepath=str(args.source_dir/name))
selected=[]
for o in bpy.data.objects:
 if o.type=='MESH' and o.name[:-2] in labels and o.name[-2:] in ['.l','.r']:
  selected.append(o)
assert len(selected)==14
# Detach all selected source world matrices before removing unrelated objects.
for o in selected:
 matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=matrix;o.data=o.data.copy()
for o in list(bpy.data.objects):
 if o not in selected:bpy.data.objects.remove(o,do_unlink=True)
blob=bytearray()
def pack(values,typ):
 offset=len(blob);blob.extend(struct.pack('<'+str(len(values))+typ,*values))
 return {'offset':offset,'count':len(values),'type':typ}
structures=[]
for o in sorted(selected,key=lambda o:o.name):
 kind,jaw,label=labels[o.name[:-2]]
 matrix=o.matrix_world.copy()
 for v in o.data.vertices:
  p=matrix@v.co;v.co=(p.x*1000,(p.z-1.535)*1000,-(p.y+0.065)*1000)
 o.matrix_world=Matrix.Identity(4);o.data.update()
 for poly in o.data.polygons:poly.use_smooth=True
 o.data.calc_loop_triangles()
 pos=[c for v in o.data.vertices for c in v.co]
 norm=[c for v in o.data.vertices for c in v.normal]
 indices=[i for t in o.data.loop_triangles for i in t.vertices]
 structures.append({'name':o.name,'label':('Sol ' if o.name.endswith('.l') else 'Sağ ')+label,'kind':kind,'jaw':jaw,'fdi':None,'positions':pack(pos,'f'),'normals':pack(norm,'f'),'indices':pack(indices,'I'),'groups':[{'start':0,'count':len(indices),'material':kind}]})
manifest={'format':'dkb-mesh-v1','license':'CC-BY-SA-4.0','sourceRevision':revision,'sourceFiles':[{'name':n,'sha256':h,'url':'https://raw.githubusercontent.com/LluisV/Z-Anatomy/'+revision+'/Resources/Models/FBX/'+n} for n,h in expected.items()],'binarySha256':hashlib.sha256(blob).hexdigest(),'structures':structures,'changes':['named surface subset','same rigid coordinate transform as dentition','smooth normals','binary packing; no subdivision or invented branches'],'credits':['BodyParts3D / DBCLS / CC BY-SA 2.1 Japan','Z-Anatomy / CC BY-SA 4.0','Cranial Nerves and Foramina / University of Dundee, CAHID / CC BY 4.0 as stated by Z-Anatomy'],'missing':['intrapulpal nerves and vessels','capillaries','veins','complete dental terminal branches'],'publicationStatus':'local source candidate; expert and rights review pending'}
args.output_dir.mkdir(parents=True,exist_ok=True)
(args.output_dir/'neurovascular.bin').write_bytes(blob)
(args.output_dir/'neurovascular.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False))
print('EXPORT',len(structures),len(blob))
