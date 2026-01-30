# Aletheia
Designs and resources for the Finite Aletheia: a versatile, 8-bit hand-bootstrapped computer.

## Building and running the simulator
Before building the simulator for the first time, ensure that development dependencies are installed by running:

```bash
cd simulator
./build.sh --install-dev
```

The Aletheia simulator can be built by running the following in the `simulator` directory:

```bash
./build.sh && python3 -m http.server
```

The simulator will then be available at [localhost:8000](http://localhost:8000).