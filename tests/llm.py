#!/usr/bin/env python3
"""
Simple test script to check API availability using OpenAI client
"""

import os
import sys
from openai import OpenAI

def test_api_availability():
    """Test the availability of the askgenie API endpoint"""

    # Initialize OpenAI client with custom base URL
    client = OpenAI(
        base_url="https://askgenie-api.oagpuservices.com/v1",
        api_key="dummy-key"  # Using dummy key since this is just testing availability
    )

    try:
        # Test by listing available models
        print("Testing API availability...")
        print(f"Base URL: {client.base_url}")

        models = client.models.list()
        print(f"✅ API is available!")
        print(f"Found {len(models.data)} model(s):")

        for model in models.data:
            print(f"  - {model.id}")
            print(f"    Max tokens: {model.max_model_len}")
            print(f"    Owner: {model.owned_by}")
            print()

        return True

    except Exception as e:
        print(f"❌ API test failed: {str(e)}")
        return False

def test_model_completion():
    """Test the model by making an actual completion request"""

    # Initialize OpenAI client with custom base URL
    client = OpenAI(
        base_url="https://askgenie-api.oagpuservices.com/v1",
        api_key="dummy-key"  # May need a real key for completions
    )

    try:
        print("\n" + "="*50)
        print("Testing model completion...")

        # Test with a simple prompt
        response = client.chat.completions.create(
            model="Llama-4-Maverick-17B-128E-Instruct-FP8",
            messages=[
                {"role": "user", "content": "Hello! Please respond with a brief greeting and tell me what you are."}
            ],
            max_tokens=100,
            temperature=0.7
        )

        print("✅ Model completion successful!")
        print(f"Model: {response.model}")
        print(f"Response: {response.choices[0].message.content}")
        print(f"Usage: {response.usage}")

        return True

    except Exception as e:
        print(f"❌ Model completion failed: {str(e)}")
        return False

if __name__ == "__main__":
    # Test API availability first
    api_success = test_api_availability()

    if api_success:
        # If API is available, test model completion
        model_success = test_model_completion()
        success = api_success and model_success
    else:
        success = False

    print("\n" + "="*50)
    if success:
        print("🎉 All tests passed! API and model are working correctly.")
    else:
        print("⚠️ Some tests failed. Check the output above for details.")

    sys.exit(0 if success else 1)
