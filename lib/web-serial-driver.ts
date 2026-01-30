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
        if (this.reader) {
            await this.reader.cancel();
            await this.readableStreamClosed?.catch(() => { });
            this.reader = null;
        }
        if (this.writer) {
            await this.writer.close();
            await this.writableStreamClosed;
            this.writer = null;
        }
        if (this.port) {
            await this.port.close();
            this.port = null;
        }
    }

    async write(data: Uint8Array) {
        if (!this.writer) return;
        await this.writer.write(data);
    }

    async read(length: number): Promise<Uint8Array> {
        if (!this.port || !this.port.readable) return new Uint8Array(0);

        // Simple blocking read implementation for demo
        // In production, we'd want a proper buffer queue
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

    constructor() {
        this.connection = new SerialConnection();
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
        // Address 56 (0x38) is Present Position (2 bytes)
        const addr = 56;
        const readLen = 2;

        const params = [addr, readLen];
        const packet = this.createPacket(id, INST_READ, params);

        // Clear buffer before write (hacky but helps)
        await this.connection.read(100);

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
    }

    async setPosition(id: number, position: number, speed: number = 0, time: number = 0) {
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
    }
}
