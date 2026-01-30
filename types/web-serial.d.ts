interface SerialPort {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
}

interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'odd';
    bufferSize?: number;
    flowControl?: 'none' | 'hardware';
}

interface Navigator {
    serial: {
        requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
        getPorts(): Promise<SerialPort[]>;
    };
}

interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
}

interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
}
