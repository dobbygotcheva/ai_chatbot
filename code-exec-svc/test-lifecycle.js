const { ContainerManager } = require("./dist/services/container-manager");

async function testLifecycle() {
  console.log("Starting container lifecycle test...\n");

  const manager = new ContainerManager();

  try {
    console.log("1. Creating Python container...");
    const container = await manager.createContainer("python");
    console.log(`   Container ID: ${container.id.slice(0, 12)}`);

    console.log('\n2. Executing code: print("Hello from container!")');
    const result = await manager.executeInContainer(
      container,
      'print("Hello from container!")',
      "python",
    );

    console.log(`   Execution ID: ${result.execution_id}`);
    console.log(`   Exit Code: ${result.exit_code}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Stdout: ${result.stdout.trim()}`);
    console.log(`   Stderr: ${result.stderr}`);

    console.log("\n3. Destroying container...");
    await manager.destroyContainer(container);
    console.log("   Container destroyed");

    console.log("\n✓ Lifecycle test completed successfully!\n");
  } catch (error) {
    console.error("\n✗ Test failed:", error.message);
    process.exit(1);
  }
}

testLifecycle();
