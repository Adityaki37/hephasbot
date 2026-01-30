
import logging
import sys
import time
import serial.tools.list_ports

# Setup verbose logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("debug_robot")

try:
    from lerobot.robots.so_follower.so_follower import SOFollower
    from lerobot.robots.so_follower.config_so_follower import SOFollowerRobotConfig
    print("Imports successful")
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)

def find_port():
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        print(f"Found port: {p.device} - {p.description}")
        if "USB" in p.description or "Serial" in p.description:
            return p.device
    return "COM4"

def test_connection():
    port = find_port()
    print(f"Attempting connection on {port}")
    
    config = SOFollowerRobotConfig(port=port, use_degrees=True)
    print(f"Config created: {config}")
    
    print("Instantiating remote object...")
    robot = SOFollower(config=config)
    
    print("Calling robot.connect()...")
    robot.connect(calibrate=False)
    print("SUCCESS: Connected!")
    
    print("Reading observation...")
    obs = robot.get_observation()
    print(f"Observation: {obs}")
    
    robot.disconnect()
    print("Disconnected.")

if __name__ == "__main__":
    try:
        test_connection()
    except BaseException as e:
        print(f"CRITICAL EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
