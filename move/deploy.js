require('dotenv').config();
const mnemonic = process.env.PHRASE;
const net = process.env.NET;

console.log({ mnemonic, net });

const { getFullnodeUrl, SuiClient } = require('@mysten/sui/client');
const { Transaction } = require('@mysten/sui/transactions');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
const rpcUrl = getFullnodeUrl(net);

// create a client connected to the specified network
const client = new SuiClient({ url: rpcUrl });

const fs = require("fs");

async function publish(cliPath, packagePath) {
    const { execSync } = require('child_process');

    // Compile .move into base64 bytecode
    const { modules, dependencies } = JSON.parse(
        execSync(
            `${cliPath} move build --dump-bytecode-as-base64 --path ${packagePath}`,
            { encoding: 'utf-8' },
        ),
    );
    const tx = new Transaction();
    const [upgradeCap] = tx.publish({
        modules,
        dependencies,
    });
    tx.transferObjects([upgradeCap], tx.pure.address(await keypair.toSuiAddress()));

    // Send the transaction to publish it and obtain Upgrade Capability
    const result = await client.signAndExecuteTransaction({ transaction: tx, signer: keypair });
    console.log({ result });

    // Wait for transaction to be processed
    await new Promise(r => setTimeout(r, 10000));

    // Lookup this transaction block by digest
    const effects = await client.getTransactionBlock({
        digest: result.digest,
        // only fetch the effects field
        options: { showEffects: true },
    });

    // Find the right transaction which created the contract
    const created = effects.effects.created.filter(effect => effect.owner == "Immutable");
    console.log({ result }, effects.effects.created, created, effects.effects.created[0].reference.objectId);

    const package_id = created[0].reference.objectId;

    // Output the new created package id in a text file
    fs.writeFile('package.id', package_id, (err) => {
        if (err) throw err;
        console.log('Package ID saved to file!');
    });

    // Also write to frontend networkConfig.ts
    const networkConfigPath = '../frontend/src/constants.ts';
    let networkConfig = fs.readFileSync(networkConfigPath, 'utf8');
    
    // Replace the packageId in the networkConfig.ts file
    networkConfig = networkConfig.replace(
        /TESTNET_PACKAGE_ID = '0x[a-fA-F0-9]+'/, 
        `TESTNET_PACKAGE_ID = '${package_id}'`
    );
    
    fs.writeFileSync(networkConfigPath, networkConfig);
    console.log('Package ID updated in frontend networkConfig.ts!');
    
    // Initialize the advertisement registry
    console.log('Initializing advertisement registry...');
    const initTx = new Transaction();
    initTx.moveCall({
        target: `${package_id}::marketplace::initialize_registry`,
        arguments: [],
    });
    
    // Send the transaction to initialize the registry
    const initResult = await client.signAndExecuteTransaction({ transaction: initTx, signer: keypair });
    console.log('Registry initialization result:', initResult);
    
    // Wait for transaction to be processed
    await new Promise(r => setTimeout(r, 10000));
    
    // Lookup this transaction block by digest to get the registry ID
    const initEffects = await client.getTransactionBlock({
        digest: initResult.digest,
        options: { showEffects: true },
    });
    
    console.log({initEffects});

    // Find the right transaction which created the registry
    const registryObj = initEffects.effects.created?.[0];
    console.log({ created: initEffects.effects.created, registryObj });
    
    if (registryObj) {
        const registry_id = registryObj.reference.objectId;
        console.log('Registry ID:', registry_id);
        
        // Update the registry ID in the constants.ts file
        networkConfig = fs.readFileSync(networkConfigPath, 'utf8');
        networkConfig = networkConfig.replace(
            /TESTNET_REGISTRY_ID = '0x[a-fA-F0-9]+'|TESTNET_REGISTRY_ID = '0xTODO'/, 
            `TESTNET_REGISTRY_ID = '${registry_id}'`
        );
        
        fs.writeFileSync(networkConfigPath, networkConfig);
        console.log('Registry ID updated in frontend constants.ts!');
    } else {
        console.error('Failed to find registry object in transaction effects');
    }
}

// Call the publish function with the path to the sui CLI and the path to the package
publish("sui", ".");
