export class SerialConnection {
    port: SerialPort | null = null;
    reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    encoder = new TextEncoder();
    decoder = new TextDecoder();
    readableStreamClosed: Promise<void> | null = null;
    writableStreamClosed: Promise<void> | null = null;

    async connect(baudRate: number = 1000000) {
        if (!navigator.serial) {
            console.error("Web Serial API not supported in this browser");
            return false;
        }
        try {
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate });

            // Setup writer
            if (this.port.writable) {
                this.writer = this.port.writable.getWriter();
            }

            return true;
        } catch (error) {
            console.error("Error connecting to serial port:", error);
            return false;
        }
    }

    async disconnect() {
        try {
            // Release writer first
            if (this.writer) {
                try {
                    await this.writer.close();
                } catch (e) {
                    console.warn("Writer close error (may already be closed):", e);
                }
                this.writer = null;
            }

            // Wait for any locked readable stream to be released
            if (this.port?.readable?.locked) {
                console.log("Waiting for readable stream lock to release...");
                // Give pending reads a moment to complete
                await new Promise(r => setTimeout(r, 100));
            }

            // Cancel persistent reader if exists
            if (this.reader) {
                try {
                    await this.reader.cancel();
                } catch (e) {
                    console.warn("Reader cancel error:", e);
                }
                this.reader = null;
            }

            await this.readableStreamClosed?.catch(() => { });
            await this.writableStreamClosed?.catch(() => { });

            // Close the port
            if (this.port) {
                try {
                    // Wait a bit more if still locked
                    if (this.port.readable?.locked || this.port.writable?.locked) {
                        await new Promise(r => setTimeout(r, 200));
                    }
                    await this.port.close();
                } catch (e) {
                    console.warn("Port close error:", e);
                }
                this.port = null;
            }
        } catch (e) {
            console.error("Disconnect error:", e);
            // Force cleanup
            this.reader = null;
            this.writer = null;
            this.port = null;
        }
    }

    async write(data: Uint8Array) {
        if (!this.writer) return;
        await this.writer.write(data);
    }

    async read(length: number): Promise<Uint8Array> {
        if (!this.port || !this.port.readable) return new Uint8Array(0);

        // Wait if stream is locked (prevent "locked to a reader" error)
        while (this.port.readable.locked) {
            await new Promise(r => setTimeout(r, 5));
        }

        const reader = this.port.readable.getReader();
        try {
            const { value, done } = await reader.read();
            if (done || !value) return new Uint8Array(0);
            return value;
        } finally {
            reader.releaseLock();
        }
    }
}

// STS/SCS Protocol Constants
const INST_PING = 0x01;
const INST_READ = 0x02;
const INST_WRITE = 0x03;
const INST_REG_WRITE = 0x04;
const INST_ACTION = 0x05;
const INST_SYNC_WRITE = 0x83;

export class RobotDriver {
    connection: SerialConnection;
    private _mutex = Promise.resolve();

    constructor() {
        this.connection = new SerialConnection();
    }

    // Mutex helper to ensure atomic transactions
    private async runExclusive<T>(task: () => Promise<T>): Promise<T> {
        let release: () => void;
        const currentLock = new Promise<void>(resolve => { release = resolve; });

        // Chain the new lock to the existing one
        const previousLock = this._mutex;
        this._mutex = currentLock;

        // Wait for previous to finish
        await previousLock.catch(() => { });

        try {
            return await task();
        } finally {
            release!();
        }
    }

    async connect() {
        return await this.connection.connect();
    }

    async disconnect() {
        return await this.connection.disconnect();
    }

    // STS Protocol Packet Construction
    // Header(2) + ID(1) + Len(1) + Inst(1) + Params(N) + Checksum(1)
    createPacket(id: number, instruction: number, params: number[] = []): Uint8Array {
        const length = params.length + 2; // Instruction + Params + Checksum
        const packet = [0xFF, 0xFF, id, length, instruction, ...params];

        // Calculate Checksum: bit inversion of (ID + Length + Instruction + Params_Sum)
        let sum = id + length + instruction;
        for (const p of params) {
            sum += p;
        }
        const checksum = ~(sum) & 0xFF;
        packet.push(checksum);

        return new Uint8Array(packet);
    }

    async writeRegister(id: number, address: number, value: number, bytes: number = 2) {
        await this.runExclusive(async () => {
            // Little Endian
            const params = [address];
            if (bytes === 1) {
                params.push(value & 0xFF);
            } else if (bytes === 2) {
                params.push(value & 0xFF);
                params.push((value >> 8) & 0xFF);
            }

            const packet = this.createPacket(id, INST_WRITE, params);
            await this.connection.write(packet);
        });
    }

    async setTorque(id: number, enable: boolean) {
        await this.writeRegister(id, 40, enable ? 1 : 0, 1); // Address 40 is usually Torque Enable
    }

    async readPacket(expectedId: number, length: number): Promise<Uint8Array | null> {
        // Simple polling read. In production, need a robust parser buffer.
        // For STS: Header(2) + ID(1) + Len(1) + Error(1) + Params(N) + Checksum(1)
        // Total = 6 + N. For Read Position (2 bytes), response param is 2 bytes. Total 8 bytes.

        // Wait a bit for response
        await new Promise(r => setTimeout(r, 2)); // 2ms turnaround

        // Read more than needed just in case
        const data = await this.connection.read(length + 10);
        if (data.length < length) return null;

        // Find header
        let start = -1;
        for (let i = 0; i < data.length - 1; i++) {
            if (data[i] === 0xFF && data[i + 1] === 0xFF) {
                start = i;
                break;
            }
        }
        if (start === -1) return null;

        // Validate ID
        if (data[start + 2] !== expectedId) return null;

        return data.slice(start);
    }

    async readPosition(id: number): Promise<number> {
        return this.runExclusive(async () => {
            // Address 56 (0x38) is Present Position (2 bytes)
            const addr = 56;
            const readLen = 2;

            const params = [addr, readLen];
            const packet = this.createPacket(id, INST_READ, params);

            // Clear buffer before write (hacky but helps) - REMOVED blocking read
            // await this.connection.read(100);

            await this.connection.write(packet);

            // Expected response size: 2 header + 1 id + 1 len + 1 err + 2 params + 1 check = 8 bytes
            const res = await this.readPacket(id, 8);

            if (res && res.length >= 8) {
                // Error byte at idx 4. Params at 5, 6.
                const serverErr = res[4];
                if (serverErr !== 0) {
                    // console.warn(`Motor ${id} error: ${serverErr}`);
                }

                const low = res[5];
                const high = res[6];
                return (high << 8) | low;
            }

            return -1;
        });
    }

    async setPosition(id: number, position: number, speed: number = 0, time: number = 0) {
        await this.runExclusive(async () => {
            // Address 42 is Goal Position (2 bytes)
            // Usually followed by Time (2 bytes) and Speed (2 bytes)
            // SCS/STS is slightly different, usually:
            // Goal Position (2B) + (Time (2B)) + (Speed (2B))
            // Address 42

            const params = [42];
            // Pos
            params.push(position & 0xFF);
            params.push((position >> 8) & 0xFF);

            // Time (optional usually, but let's send 0)
            params.push(time & 0xFF);
            params.push((time >> 8) & 0xFF);

            // Speed
            params.push(speed & 0xFF);
            params.push((speed >> 8) & 0xFF);

            const packet = this.createPacket(id, INST_WRITE, params);
            await this.connection.write(packet);
        });
    }

    // Unlock EEPROM for writing configuration (required before changing limits)
    // Address 55 (0x37) = Lock/Unlock. Write 0 to unlock.
    async unlockEEPROM(id: number) {
        await this.runExclusive(async () => {
            const params = [55, 0]; // Address 55, Value 0 (unlock)
            const packet = this.createPacket(id, INST_WRITE, params);
            await this.connection.write(packet);
        });
    }

    // Lock EEPROM after writing configuration
    async lockEEPROM(id: number) {
        await this.runExclusive(async () => {
            const params = [55, 1]; // Address 55, Value 1 (lock)
            const packet = this.createPacket(id, INST_WRITE, params);
            await this.connection.write(packet);
        });
    }

    // Read position limits (Min at address 9-10, Max at address 11-12)
    async readPositionLimits(id: number): Promise<{ min: number; max: number }> {
        return this.runExclusive(async () => {
            // Read 4 bytes starting at address 9
            const addr = 9;
            const readLen = 4;

            const params = [addr, readLen];
            const packet = this.createPacket(id, INST_READ, params);
            await this.connection.write(packet);

            // Expected response: 6 header bytes + 4 data bytes = 10 bytes
            const res = await this.readPacket(id, 10);

            if (res && res.length >= 10) {
                const minLow = res[5];
                const minHigh = res[6];
                const maxLow = res[7];
                const maxHigh = res[8];
                return {
                    min: (minHigh << 8) | minLow,
                    max: (maxHigh << 8) | maxLow
                };
            }

            return { min: 0, max: 4095 }; // Default fallback
        });
    }

    // Set position limits (Min at address 9-10, Max at address 11-12)
    // IMPORTANT: Must call unlockEEPROM first, and lockEEPROM after
    async setPositionLimits(id: number, min: number, max: number) {
        await this.runExclusive(async () => {
            // Write 4 bytes starting at address 9
            const params = [9];
            // Min position (2 bytes, little endian)
            params.push(min & 0xFF);
            params.push((min >> 8) & 0xFF);
            // Max position (2 bytes, little endian)
            params.push(max & 0xFF);
            params.push((max >> 8) & 0xFF);

            const packet = this.createPacket(id, INST_WRITE, params);
            await this.connection.write(packet);
        });
    }

    // Reset a servo's position limits to full range (0-4095)
    // Use this to fix servos that got restricted limits written to EEPROM
    async resetServoLimits(id: number): Promise<boolean> {
        try {
            console.log(`[ResetLimits] Resetting servo ${id} to full range 0-4095...`);

            // Read current limits first
            const currentLimits = await this.readPositionLimits(id);
            console.log(`[ResetLimits] Servo ${id} current limits: ${currentLimits.min}-${currentLimits.max}`);

            // IMPORTANT: Disable torque BEFORE writing to EEPROM
            console.log(`[ResetLimits] Disabling torque on servo ${id}...`);
            await this.setTorque(id, false);
            await new Promise(r => setTimeout(r, 100)); // Wait for torque to disable

            // Unlock EEPROM
            console.log(`[ResetLimits] Unlocking EEPROM...`);
            await this.unlockEEPROM(id);
            await new Promise(r => setTimeout(r, 200)); // Longer wait for EEPROM unlock

            // Write full range limits
            console.log(`[ResetLimits] Writing limits 0-4095...`);
            await this.setPositionLimits(id, 0, 4095);
            await new Promise(r => setTimeout(r, 200)); // Wait for EEPROM write

            // Lock EEPROM
            console.log(`[ResetLimits] Locking EEPROM...`);
            await this.lockEEPROM(id);
            await new Promise(r => setTimeout(r, 200)); // Wait for lock

            // Verify the write
            const newLimits = await this.readPositionLimits(id);
            console.log(`[ResetLimits] Servo ${id} new limits: ${newLimits.min}-${newLimits.max}`);

            const success = newLimits.min === 0 && newLimits.max === 4095;
            if (success) {
                console.log(`[ResetLimits] ✓ Servo ${id} successfully reset to full range!`);
            } else {
                console.error(`[ResetLimits] ✗ Servo ${id} reset failed - limits are ${newLimits.min}-${newLimits.max}`);
                console.log(`[ResetLimits] Tip: Try power cycling the servo and running reset again.`);
            }

            return success;
        } catch (e) {
            console.error(`[ResetLimits] Error resetting servo ${id}:`, e);
            return false;
        }
    }

    // Reset all servos (1-6) to full range
    async resetAllServoLimits(): Promise<{ id: number; success: boolean }[]> {
        const results: { id: number; success: boolean }[] = [];

        for (let id = 1; id <= 6; id++) {
            const success = await this.resetServoLimits(id);
            results.push({ id, success });
            await new Promise(r => setTimeout(r, 50)); // Small delay between servos
        }

        return results;
    }
}
