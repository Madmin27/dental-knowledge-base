import {createIntake,loadCatalog} from '../../apps/preview/contributions.mjs';
import {previewServer} from '../../apps/preview/server.mjs';
const intake=await createIntake({directory:process.env.TEST_INTAKE_DIR,origin:'http://localhost:3059',adminKey:process.env.TEST_INTAKE_KEY,catalog:await loadCatalog(),rateLimit:1000});
const server=previewServer({intake});server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
