import { Client } from 'pg';
import { hashPassword, validateUserData } from '../auth-security';

async function connectToDatabase(): Promise<{
  error?: string;
  data?: { client: Client; connStr: string };
}> {
  const candidates = [
    process.env['DATABASE_URL'],
    'postgresql://postgres@localhost:5432/messaging_db',
    `postgresql://${process.env['USER']}@localhost:5432/messaging_db`,
    'postgresql://postgres:postgres@localhost:5432/messaging_db',
    'postgresql://postgres:password@localhost:5432/messaging_db',
  ].filter((url): url is string => Boolean(url));

  for (const connStr of candidates) {
    try {
      const client = new Client(connStr);
      await client.connect();
      await client.query('SELECT 1');
      return { data: { client, connStr } };
    } catch (_error) {
      continue;
    }
  }

  return {
    error: `Could not connect to messaging_db database.
    
Make sure you ran: npm run db:setup -w server
Or set DATABASE_URL environment variable.`,
  };
}

async function checkUserExists(
  client: Client,
  email: string
): Promise<{ error?: string; data?: boolean }> {
  try {
    const result = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    return { data: result.rows.length > 0 };
  } catch (_error) {
    return {
      error: `Database query failed: ${_error instanceof Error ? _error.message : 'unknown error'}`,
    };
  }
}

async function createUser(
  client: Client,
  userData: { username: string; email: string; password: string }
): Promise<{ error?: string; data?: any }> {
  const validation = validateUserData(userData);
  if (validation.error) {
    return { error: validation.error };
  }

  const hashedPassword = await hashPassword(validation.data!.password);
  if (hashedPassword.error) {
    return { error: hashedPassword.error };
  }

  try {
    const result = await client.query(
      `INSERT INTO users (username, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, created_at`,
      [validation.data!.username, validation.data!.email, hashedPassword.data!]
    );

    return { data: result.rows[0] };
  } catch (_error) {
    if (_error instanceof Error && _error.message.includes('duplicate key')) {
      return { error: `User already exists: ${userData.username}` };
    }
    return {
      error: `Database insert failed: ${_error instanceof Error ? _error.message : 'unknown error'}`,
    };
  }
}

async function createTestUsers(client: Client): Promise<{ error?: string; data?: any[] }> {
  const users = [
    { username: 'user', email: 'user@legora.com', password: 'legora123' },
    { username: 'alice', email: 'alice@legora.com', password: 'alice123' },
    { username: 'bob', email: 'bob@legora.com', password: 'bob12345' },
    { username: 'charlie', email: 'charlie@legora.com', password: 'charlie123' },
    { username: 'diana', email: 'diana@legora.com', password: 'diana123' },
    { username: 'eve', email: 'eve@legora.com', password: 'eve12345' },
  ];

  const createdUsers = [];

  for (const userData of users) {
    const userResult = await createUser(client, userData);
    if (userResult.error) {
      // Skip if user already exists, otherwise return error
      if (userResult.error.includes('already exists')) {
        try {
          const existing = await client.query(
            'SELECT id, username, email, created_at FROM users WHERE username = $1',
            [userData.username]
          );
          if (existing.rows.length > 0) {
            createdUsers.push(existing.rows[0]);
          }
        } catch (_err) {
          return { error: `Failed to get existing user ${userData.username}` };
        }
      } else {
        return { error: userResult.error };
      }
    } else {
      createdUsers.push(userResult.data);
    }
  }

  return { data: createdUsers };
}

async function createSampleMessages(
  client: Client,
  users: any[]
): Promise<{ error?: string; data?: any[] }> {
  const conversations = [
    // user talks with alice
    {
      sender: 'user',
      recipient: 'alice',
      content: 'Hey Alice! How are you doing today?',
      delay: 0,
    },
    {
      sender: 'alice',
      recipient: 'user',
      content:
        "Hey! I'm doing great, thanks for asking. Working on some interesting projects lately.",
      delay: 2,
    },
    {
      sender: 'user',
      recipient: 'alice',
      content: 'That sounds awesome! What kind of projects?',
      delay: 5,
    },
    {
      sender: 'alice',
      recipient: 'user',
      content: 'Mostly backend systems and APIs. Really enjoying the problem-solving aspect.',
      delay: 8,
    },

    // bob talks with user
    {
      sender: 'bob',
      recipient: 'user',
      content: 'Did you see the new features in the latest release?',
      delay: 10,
    },
    { sender: 'user', recipient: 'bob', content: "Not yet! What's new?", delay: 12 },
    {
      sender: 'bob',
      recipient: 'user',
      content:
        'They added real-time messaging and much better performance. Pretty impressive stuff.',
      delay: 15,
    },

    // charlie and diana conversation
    {
      sender: 'charlie',
      recipient: 'diana',
      content: 'Diana, are you free for a quick call later?',
      delay: 20,
    },
    { sender: 'diana', recipient: 'charlie', content: 'Sure! What time works for you?', delay: 22 },
    {
      sender: 'charlie',
      recipient: 'diana',
      content: 'How about 3 PM? We can discuss the new project requirements.',
      delay: 25,
    },
    { sender: 'diana', recipient: 'charlie', content: 'Perfect, see you then!', delay: 27 },

    // eve talks with multiple people
    {
      sender: 'eve',
      recipient: 'user',
      content: 'Welcome to the platform! Hope you enjoy using it.',
      delay: 30,
    },
    {
      sender: 'eve',
      recipient: 'alice',
      content: 'Alice, loved your recent work on the authentication system!',
      delay: 32,
    },
    {
      sender: 'alice',
      recipient: 'eve',
      content: 'Thanks Eve! It was a fun challenge to implement.',
      delay: 35,
    },
  ];

  const userMap = new Map(users.map(u => [u.username, u.id]));
  const createdMessages = [];

  const baseTime = new Date();

  for (const conv of conversations) {
    const senderId = userMap.get(conv.sender);
    const recipientId = userMap.get(conv.recipient);

    if (!senderId || !recipientId) {
      continue; 
    }

    const messageTime = new Date(baseTime.getTime() - 60000 * (conversations.length - conv.delay));

    try {
      const result = await client.query(
        `INSERT INTO messages (content, sender_id, recipient_id, created_at) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, content, sender_id, recipient_id, created_at`,
        [conv.content, senderId, recipientId, messageTime]
      );
      createdMessages.push(result.rows[0]);
    } catch (_error) {
      console.warn(`Failed to create message from ${conv.sender} to ${conv.recipient}:`, _error);
    }
  }

  return { data: createdMessages };
}

function displaySuccess(users: any[], messages: any[], connStr: string): void {
  console.log(`
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                      DATABASE SEEDED                                                     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Users Created: ${users.length.toString().padEnd(42)}                                     │
│ Messages Created: ${messages.length.toString().padEnd(39)}                               │
│ Database: ${connStr.length > 43 ? connStr.substring(0, 40) + '...' : connStr.padEnd(43)} │
│                                                                                          │
│ > Available Users:                                                                       │
│   user@legora.com / legora123                                                            │
│   alice@legora.com / alice123                                                            │
│   bob@legora.com / bob12345                                                              │
│   charlie@legora.com / charlie123                                                        │
│   diana@legora.com / diana123                                                            │
│   eve@legora.com / eve12345                                                              │
│                                                                                          │
│ > Sample conversations created between users                                             │
│ > Next Steps: npm run dev   
                                                             
    **##############%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%*#%@@@@@%%#--=+=-::::
###%%%%%%%%%%@@@@@@@@@@@@@@@@@@@%#%@%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%*#%@@@@@@%#--::===:::
*#%%%@%#*%%+*+++=+#*++*+*#****#@@@@@%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%@@@@@@@@@#*#%@@@@@%%##=-:::-+=:
%#%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#**%@@@@@%%#==+--:::-=
#%%%%@@%%%@%@%#%@%%%%%%#%%%%%########%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#*#%@@@@@%%#---++--:::
%%%%%@@%#%@%@@%%@%%%%%%%%@%%@@@@@@@%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#*#%@@@@@%#*---:-++--:
##%%%@@@@@@%%@@@@#*#####%#%%##*##*#*#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#*#%@@@@@%#+--::::-+=-
%##%%@@@@@@@@@@@@%%@@@@@@%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#*#@@@@@@%#=--::::-:-*
%%%%%@@@@@@%%@@@@%%#####%#%%##%@@@@@@@@@@%@%%@@%%@@%@%@%%%@@@@@@@@@@@@@@@@@@@@#*#@@@@@@%#---::::::::
%%%%%@@@@@@@%@@@@%%%%@%%#######%%#**#*#***%#*#%#%%@%%%@%%@@@@@@@%%%%%@@@@@@@@@#*#@@@@@@%*----:::::::
%%%%%@@@@@@%%@@@@@%%@@%%%%%%@@@@@@@%@#%#%%@%##%#####%%%##%#%###%%%%%%@@@@@@@@%#*%@@@@@@%+----:::::::
##%%%%%%%%%%%%@@@@@@@@@#**%####*##%%%#@%@%@%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##%@@@@@@%=-----::::::
%%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##%@@@@@@#=-----::::::
%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##%@@@@@%*=------::::-
%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##%@@@@@%*=------::::-
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##%@@@@@%+-------:::-+
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##@@@@@@%+--------::-*
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##@@@@@@#+----------=+
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%#%@@@@@@#=----------+=
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%#%@@@@@@*=---------=+-
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%#%@@@@@%*=---------++-
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%@@@@@#+=---------+==
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%@@@@@#+=--------=++=
@@@@@@@@@@@@@@@@@@@@@@@@%%+#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%@@@@@@#==--------++++
@@@@@@@@@@@@@@@@@@@@@@@#=-:=%@@%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%@@@@@%*===-------++*%
@@@@@@@@@@@@@@@@@@@@@%@#=::-+%@#%@@@@@@@@@@@@@@@@@@@@@@%%%%%%%%%%%%%%%%%%%%%%%%@@@@@%*==-------=*=-=
@@@@@@@@@@@@@@@@@@@@@#@#=:::-#@**@@@@@@@%######%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%@@@@@%+===------++=--
@@@@@@@@@@@@@@@@@%%@%*@#=:::-*@%@@@@@@@@%###%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%@@@@@#+===------*==--
@@@@@@@@@@#@@@@@@%#@%+##-::-+%%+++*%@@@@%#%%%%%%%%%%%%%%%%%%%%%%@@@@@@@@@@@@@@@@@@@%#+====----+++---
@@@@@@@@@%+@@@@@@%*%#+=*-:-+*****##%@@%%%%%%%%%%%%%@@@@@@@@@@%%%@@@@@@@@@%@@@@%%@@@%#+====----*==---
@@@@@@@@@*+*@@#*#%#%#+:-:::=*#%%-+*%@@#############@@#####**%*++#*#%%%%%#*@@#***%%@##+====---=*+----
@@@@@@@@@#+*@@%*==----::::-=+#%+-**%@+======+++++*#@@##%%%%%@#****%@@@@@@@@@@%%%#%@%#+====---*++----
@@@@@@@@@%*-=+++**=-:::::::::--=++*%@%%%%%%@@@@@@%%###%%%%#*+++#+#@@%@@@@@@@@@@%##%@**+===--=+*-----
@@%%@@#%%%+*#%%*-=-::::::::::::::=*@@#*****####%%%%%%%%%%%%%%%@@@@@@@@@@@@@@@@@%##%@#*+===--++------
@@%*%#=--+%#%%%+:::::::::::::::::=#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%#%@%###@%*+===--+=------
%#%**+=:::-====-::::::::::--::::-+%@@@@@@@@@@@@@@@@@@@@%%%%%%%%%%%#%%%%%######@%###%@#*=====+=------
@@@##+-::::.::..:::::::::::=+===+#@@%%%%%#####%%%%########%%###########%######@@####@#*+===++-------
@@@@@@%=:::::::::::::::::-=++++*%@@@%%%%%###%%%%%%%%%%@@@@@@@@@###############%@%###%%*+===+=-------
@@@@@@@@*-:::::::::::::::---=+*%@@@@@@@@%%%%%%%@@%%%@@@%@@@@@@@@%##############@%###%@#*+=+*=-------
@@@@@@@@@%*-:::::::::::-==--*%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##############%@%###@%*+=++=-------
@@@@@@@@@@@%*=-:::::::::::=#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@##############%@%###%%**=*====-----
*%#%*#@@@@@@@%***+=--:::-+@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@###############@%###%@#*+*====-----
===-+==*%@@@@@@#+==+**++*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@###############%@####%%##+=====----
==-:----=++=-::::::-=++**%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##############%@%###%@**+=====----
::::::...:::.....:::::::=++***#%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@%###############@%###%@#*+======---
:.........:.:::-=+***+++++=++*++*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%#**############%@%###%%**+========
::..::.:--::...:-::..::::::::=#*+#@@@@@@@@@@@@@@@@@@@@@@@@%%%@@@@%#*#############%@%###%@#*++======*
:::--:...::::::..:::.::--========+*#%%@@@@@@@@@@@@@@@@@@@@@@@@@%@%#**############%@%###%@%**++====+#
=::::::::::.::.......:::::::::::::::-=*%@@@@@@@@@@@@@@@@@@@@@@@@@%##*#############@@####%@**+++===*+
:::::::::::....:......::.::::::::::::::=*#%%%%%@@@@@@@@@@@@%%%%%##**##############%@%###%@#**++==+*+
::-:::::::::.:......::::::..::::::---===+-:::::=+*########%#######################%@%%###@%#*++++**+
*--=-:::::::::::::::::::::.::::::::::::=-:::::::=+++++=+##%###**###################@@%%##%@#**++*#++
++=:::::::::::::::::::::::::::::::::::--::::::::-++++::::=%%%%#**##########%#######%@%%%%%@%#*+*#*++
+-::::::::::::::::::::::::::::::::::::-::::::::::++++=::::=%#+==--+*#%%%%%%%#######%@%%%%%@@##*##*++

└──────────────────────────────────────────────────────────────────────────────────────────┘`);
}

async function seedDatabase(): Promise<{ error?: string }> {
  // Connect to database
  const connection = await connectToDatabase();
  if (connection.error) {
    return { error: connection.error };
  }

  const { client, connStr } = connection.data!;

  try {
    console.log(`
┌─────────────────────────────────────────────────┐
│                  DATABASE SETUP                  │
├─────────────────────────────────────────────────┤
│ ✓ Connected to database${' '.repeat(19)} │
│ → Starting seeding process${' '.repeat(16)} │
└─────────────────────────────────────────────────┘`);

    // Check if users already exist
    const userExists = await checkUserExists(client, 'user@legora.com');
    if (userExists.error) {
      return { error: userExists.error };
    }

    if (userExists.data) {
      console.log(`
┌─────────────────────────────────────────────────┐
│              SEEDING SKIPPED                 │
├─────────────────────────────────────────────────┤
│ Users already exist                            │
│ Login: user@legora.com / legora123             │
│ Also: alice, bob, charlie, diana, eve          │
└─────────────────────────────────────────────────┘`);
      return {};
    }

    // Create the test users
    const usersResult = await createTestUsers(client);
    if (usersResult.error) {
      return { error: usersResult.error };
    }

    const users = usersResult.data!;
    console.log(`✓ Created ${users.length} users`);

    const messagesResult = await createSampleMessages(client, users);
    if (messagesResult.error) {
      console.warn('Warning: Failed to create some messages:', messagesResult.error);
    }

    const messages = messagesResult.data || [];
    console.log(`✓ Created ${messages.length} sample messages`);

    displaySuccess(users, messages, connStr);
    return {};
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(result => {
      if (result.error) {
        console.error(`[ERROR] Seeding failed: ${result.error}`);
        process.exit(1);
      }
      console.log('[OK] Seeding completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('[ERROR] Unexpected error:', error);
      process.exit(1);
    });
}

export { seedDatabase };
