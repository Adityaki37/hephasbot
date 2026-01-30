
import sys
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("inspector")

try:
    print("Importing ManipulatorRobot...")
    from lerobot.common.robot_devices.robots.manipulator import ManipulatorRobot
    print("Successfully imported ManipulatorRobot")
    
    print("\n--- Class Inspection ---")
    print(f"Class: {ManipulatorRobot}")
    print(f"Dir: {dir(ManipulatorRobot)}")
    
    print("\n--- Instantiation Attempt (Mock) ---")
    # Try to instantiate without connecting to see structure
    # We might fail if it demands real hardware immediately, but let's try.
    try:
        # We use a known safe config or just try expected so_100
        robot = ManipulatorRobot(robot_type='so_100')
        print("Instantiated robot object.")
        print(f"Robot Dir: {dir(robot)}")
        
        if hasattr(robot, 'leader_arms'):
            print(f"Lead Arms: {robot.leader_arms}")
        if hasattr(robot, 'follower_arms'):
            print(f"Follower Arms: {robot.follower_arms}")
            
        print("\n--- Methods ---")
        methods = [func for func in dir(robot) if callable(getattr(robot, func)) and not func.startswith("__")]
        print(f"Callable Methods: {methods}")

    except Exception as e:
        print(f"Instantiation failed (expected if no robot): {e}")

except ImportError:
    print("Could not import lerobot. Is it installed?")
    # Try finding where it might be
    import pkgutil
    print("Installed modules:", [m.name for m in pkgutil.iter_modules()])
except Exception as e:
    print(f"Unexpected error: {e}")
