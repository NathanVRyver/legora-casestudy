import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Smart PostgreSQL connection | tries common configurations -- dx tingz
async function getWorkingConnection() {
  const candidates = [
    // 1. Environment variable first
    process.env['DATABASE_URL'],
    // 2. Common superuser
    'postgresql://postgres@localhost:5432/postgres',
    // 3. Current user
    `postgresql://${process.env['USER']}@localhost:5432/postgres`,
    // 4. With common passwords
    'postgresql://postgres:postgres@localhost:5432/postgres',
    'postgresql://postgres:password@localhost:5432/postgres',
    // 5. Linux/Unix
    'postgresql:///postgres',
  ].filter(Boolean);

  for (const connStr of candidates) {
    try {
      console.log(`Trying connection...`);
      const client = new Client(connStr);
      await client.connect();
      await client.query('SELECT 1'); // Test query
      console.log('[OK] Connected successfully!');
      return { client, connStr };
    } catch (_error) {
      // try other candidates, at the end we're showing them the message anyway
      continue;
    }
  }

  throw new Error(`
[ERROR] Could not connect to PostgreSQL!

Try one of these:
1. Start PostgreSQL: brew services start postgresql (use "brew services start postgres@14" i think)
2. Set DATABASE_URL environment variable (.env)
  `);
}

async function setupDatabase() {
  let adminClient: Client;
  let baseConnStr: string;


try {
  const result = await getWorkingConnection();

  if (!result || typeof result.connStr !== "string") {
    throw new Error("Woorking connection missing a valid connStr");
  }

  adminClient = result.client;
  baseConnStr = result.connStr;

} catch (err: unknown) {
  const msg =
    err instanceof Error ? err.message :
    typeof err === "string" ? err :
    "An error happened while establishing a connection";
  console.error(msg);
  process.exit(1);
}

  const dbName = 'messaging_db';

  const url = new URL(baseConnStr);
  url.pathname = `/${dbName}`;
  const targetDb = url.toString();

  try {
    const dbResult = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      dbName,
    ]);

    if (dbResult.rows.length === 0) {
      console.log(`Attempting to create database: ${dbName}`);
      try {
        await adminClient.query(`CREATE DATABASE "${dbName}"`);
        console.log('[OK] Database created successfully!');
      } catch (createError: any) {
        if (createError.message.includes('permission denied')) {
          console.log(`
[WARN] No permission to create database automatically.

Please run ONE of these commands manually:

Option 1 (connect to postgres database):
  psql -d postgres -c "CREATE DATABASE ${dbName};"

Option 2 (if you have a postgres user):
  psql -U postgres -c "CREATE DATABASE ${dbName};"
                    .                   .        .                                                    
      .                             .           ...++.                        .    .      .         
     .                  .                      .#@@%@.                                         . .  
                                         ....-@@%##%@+==-:....     .          .                     
                           . .        .+%@@@@@#####%@%%%%%%@@@@*:                                   
            .      .            ..-#@@%###%@%######@@###########%@@%=..                             
                     .    .. ..*@@%######%@%#######@%###########%%%#%%@@#-......                    
         .    .            .*@@##########@%########@%#%@@@@@@@@%%%@%#####%@@@@@@.                   
    .                   .+@@@@@@@@@@@@@%%@%#######%@@%##########%@%##########@@:.          .        
        ..        .    .#@@@%%#########%%@########%@###########@@##########%@-..        .           
                    ..=@%##%@%###########@###################%@%%%%#########%@#..                   
   .                .%@##@@@@%@@%########%%################%@%####%%@@%#######%@-.                  
     .           . .@%@@%#######%@################%%%#################%@@%######@*.                 
               ..=#@@%###################%@%@@@@#+:=@@@@@@@@@@%%#########%@@@%###@%.         . .    
               .@%##############%@@@%*=-:::....................:@############%@@@#%@.              .
                .@@############@................................-%@%########%%@@@##%@+.             
      . ..   .  .@%@@@%######%@:...................................:*@%#####%@%######@%:            
              ..@%#########%@:........................................%@######@@%#%@@@%.            
             .=@%##%#####%@=..........................................=@########@@@@.               
           .=@@##%@#####%#.................................-%@%.......:@#########%@@..          .   
    .       :#@@@@%######@=.......:*%%+-..............:+@#-............:@##########%@@:             
              .%@######%@:..............-+:.............................*@###%@@@@@@*.   .          
       .  . .-@@#######%%................................:...:+@@@@@*:...@%###%%%%@=                
          ..%@%########%@...............*-............:%-=@@@#+==--==#@+.@%#%%%%%%@.               .
          .@@@@%%@@@@##%@:..#@@@@@@@@@@@=.:............*@*.%@+=#@=.  -@.+@#@@%%%%@*.                
   .           .-@%%%@##@=.@#.   ..=@@@##%@+..........:..:@+=====#%. ...@@@+..=%@%.                 
 .              .%@%%@@%@*..@:. ..@+====*@:..............##=======@- ...@=......:@*.     .          
                .=@@@%#%@@..... .*#======+@..............@+=======@-.............=@.    .  .      . 
            .    :@-.............#*=======@=.............#%--::::#%..............+%.     .   .      
                .%+..............:@==----=@:..............#@*::#@*..............-@=          .     .
                .@=...............-@+:::=@=..................:....:.:.:........*@-.                 
           .    .##...........:.:.:.:*@#-...................................-%@=.                   
  .              .@#......:@:..:......................-%:..............+@@@%-.        .             
         .        .+@#=....:@-..............:*@*++*#@=...............=@@@@.                         
                    ..=%@@@@%@#....................................*@@%%@=                  .    .  
    .                     .****@#..............................-#@@%#%@@@+.        .                
  .                  .     . ...+@@%=....-*#%%@@@@@@@%%#*+++++**+#%@@*===%=  .             .        
           .               .=@%+=@@@%%#*=------------------::------:-====%+                         
                           ..@+---:------:-----------------::::--::-=====@:                         
      .           .         .#%===------------::::---------::::---=======%#.                        
        .          .        .#%=======--:------------------------=======#@@.                       .
      .                    .@*===========---------------------:--====+@@+@%@#                 . .   
            .     .  .    .#@+=---========----------------------==+%@#===@%%%@*..        .       .  
                        .:@%#@@*------------------------------=*%@#+=====%%%#%@@-.                  
                       .#@@####%@@+==---------------------=#@@@*=====--:=%@%#@%%@*.               . 
 .                    :@%#%%######%@@%*+=============+#@@@@%#%===-------=%@%%@##%@%. .              
                    .*@####@###########%%@@@@@@@@@@@#+++@@*=@#--::::-----#@%@####%@@..              
   .  .         . ..%@#####@##############@@+-#@*-===+@@#=*%@+---:::-----#@@@#####%%@:.             
                  :@%#######@%##############@%--%@++@@#--#@@@=-----------#@%#######%%@-             
      .        ..-@%#######%@################%@#-=##*--#@@#%@-::------::-*@%#######%%%@:            
  .    .  .    .=@########%%@##################@@#==*%@@###@@::----------*@%########%%@@.           
              .+@########%%@%####################@@@@######@*::---------:*@%#########%%@#           
             .*@########%%%@###############################@+:---------:-*@%#########%%%@=          
            .*@########%%%@%##############################%@=:-----------*@%%#########%%%@..        


Then run this script again.
          `);
          process.exit(1);
        }
        throw createError;
      }
    } else {
      console.log(`[OK] Database ${dbName} already exists`);
    }
  } catch (error: any) {
    console.error('Error checking/creating database:', error.message);
    throw error;
  } finally {
    await adminClient.end();
  }

  console.log(`Connecting to database: ${targetDb}`);
  const client = new Client(targetDb);

  try {
    console.log('Setting up database schema...');
    await client.connect();

    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    await client.query(schema);

    console.log(`
+--------------------------------------------------+
|              DATABASE SCHEMA READY!             |
+--------------------------------------------------+

[INFO] Database URL: ${targetDb}
[NEXT] Run: npm run db:seed -w server`);
  } catch (error: any) {
    console.error('Failed to setup database schema:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase()
    .then(() => {
      console.log('Database setup completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Database setup failed:', error.message);
      process.exit(1);
    });
}

export { setupDatabase };
