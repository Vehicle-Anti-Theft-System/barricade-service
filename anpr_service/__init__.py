"""
ANPR Service Package

Automatic Number Plate Recognition service for detecting vehicles,
tracking them, and extracting license plate information.
"""

from .anpr_service import ANPRService, ANPRConfig, DetectionResult

__all__ = ['ANPRService', 'ANPRConfig', 'DetectionResult']
