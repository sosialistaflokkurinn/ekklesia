# Testing Guide for Cloud Functions

This document describes how to run and write unit tests for the Members Service Cloud Functions.

---

## Prerequisites

Ensure you have pytest installed (included in `requirements.txt`):

```bash
pip install -r requirements.txt
```

---

## Running Tests

### Run All Tests

```bash
pytest
```

The `pytest.ini` configuration will automatically:
- Discover all `test_*.py` files
- Run tests with verbose output
- Generate coverage reports

### Run Specific Test File

```bash
pytest test_security.py
```

### Run Specific Test Function

```bash
pytest test_security.py::test_validate_auth_input_valid
```

### Run with Coverage Report

```bash
pytest --cov=. --cov-report=html
```

Coverage report will be generated in `htmlcov/` directory. Open `htmlcov/index.html` in a browser to view detailed coverage.

### Run with Extra Verbosity

```bash
pytest -vv
```

### Run and Stop on First Failure

```bash
pytest -x
```

---

## Test Structure

### Test Files

- **test_security.py**: Tests for authentication, rate limiting, and input validation

### Test Naming Conventions

- Test files: `test_*.py` or `*_test.py`
- Test functions: `test_*`
- Test classes: `Test*`

---

## Writing New Tests

### Basic Test Example

```python
def test_example_function():
    """Test description."""
    result = my_function(input_value)
    assert result == expected_value
```

### Testing Exceptions

Use `pytest.raises()` to test exception handling:

```python
import pytest

def test_invalid_input():
    """Test that invalid input raises ValueError."""
    with pytest.raises(ValueError, match="Expected error message"):
        my_function(invalid_input)
```

### Using Fixtures

```python
import pytest

@pytest.fixture
def sample_data():
    """Provide sample data for tests."""
    return {"key": "value"}

def test_with_fixture(sample_data):
    """Test using fixture data."""
    assert sample_data["key"] == "value"
```

---

## Current Test Coverage

As of 2025-11-10:

| Module | Tests | Coverage |
|--------|-------|----------|
| security_utils | 4 tests | High |

---

## CI/CD Integration

Tests are automatically run in GitHub Actions workflows (if configured).

To run tests locally before committing:

```bash
pytest
```

---

## Best Practices

1. **Test Pure Functions First**: Focus on testing `security_utils.py` and other pure helper functions
2. **Mock External Dependencies**: Use `pytest-mock` for Firebase Admin SDK, Secret Manager, etc.
3. **Keep Tests Fast**: Unit tests should run in milliseconds
4. **Use Descriptive Names**: Test names should describe what they test
5. **One Assertion Per Test**: Each test should verify one specific behavior
6. **Test Edge Cases**: Include tests for boundary conditions and error cases

---

## Troubleshooting

### Import Errors

If you see import errors, ensure you're running tests from the functions directory:

```bash
cd services/members/functions
pytest
```

### Coverage Not Working

If coverage reports aren't generated:

```bash
pip install pytest-cov
```

### Tests Pass Locally But Fail in CI

Ensure environment variables and credentials are properly mocked in tests.

---

## Related

- **Requirements**: `requirements.txt`
- **Pytest Config**: `pytest.ini`
- **Security Tests**: `test_security.py`
- **Issue #121**: Integrate Pytest for Cloud Functions Unit Tests

---

**Last Updated**: 2025-11-10
